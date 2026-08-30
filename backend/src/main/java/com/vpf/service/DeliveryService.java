package com.vpf.service;

import com.vpf.dto.DeliveryRequest;
import com.vpf.dto.DeliveryResponse;
import com.vpf.entity.Customer;
import com.vpf.entity.CustomerOrder;
import com.vpf.entity.Delivery;
import com.vpf.entity.enums.LedgerReferenceType;
import com.vpf.entity.enums.OrderStatus;
import com.vpf.exception.BusinessRuleException;
import com.vpf.exception.ResourceNotFoundException;
import com.vpf.repository.CustomerOrderRepository;
import com.vpf.repository.DeliveryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

/**
 * Implements the confirmed billing rule (Section 2-3 of the original requirements),
 * with a fallback for the simplified current workflow:
 *   - If Received Weight is provided: Weight Difference = Dispatch - Received (KG only),
 *     and Sales Amount = Received Weight * Selling Rate (original confirmed rule).
 *   - If Received Weight is NOT provided (current default entry flow - boxes/received
 *     weight fields removed from the form): Sales Amount = Dispatch Weight * Selling Rate,
 *     and Weight Difference is left blank (nothing to compare against).
 * The selling rate is entered by the Admin per-delivery and stored with the delivery record.
 */
@Service
@RequiredArgsConstructor
public class DeliveryService {

    private final DeliveryRepository deliveryRepository;
    private final CustomerOrderRepository orderRepository;
    private final CustomerService customerService;
    private final LedgerService ledgerService;

    @Transactional
    public DeliveryResponse create(DeliveryRequest req) {
        Customer customer = customerService.getOrThrow(req.getCustomerId());

        if (req.getReceivedWeight() != null && req.getReceivedWeight().compareTo(req.getDispatchWeight()) > 0) {
            throw new BusinessRuleException("Received weight cannot be greater than dispatch weight.");
        }

        Delivery d = new Delivery();
        d.setCustomer(customer);

        if (req.getOrderId() != null) {
            CustomerOrder order = orderRepository.findById(req.getOrderId())
                    .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + req.getOrderId()));
            d.setOrder(order);
            if (order.getStatus() != OrderStatus.CANCELLED) {
                order.setStatus(OrderStatus.DELIVERED);
                orderRepository.save(order);
            }
        }

        d.setDeliveryDate(req.getDeliveryDate());
        d.setNumberOfBoxes(req.getNumberOfBoxes());
        d.setNumberOfBirds(req.getNumberOfBirds());
        d.setDispatchWeight(req.getDispatchWeight());
        d.setReceivedWeight(req.getReceivedWeight());
        d.setSellingRate(req.getSellingRate());

        BigDecimal billingWeight;
        if (req.getReceivedWeight() != null) {
            // Rule 6: Weight Difference = Dispatch Weight - Received Weight (KG only)
            d.setWeightDifference(req.getDispatchWeight().subtract(req.getReceivedWeight()).setScale(2, RoundingMode.HALF_UP));
            billingWeight = req.getReceivedWeight();
        } else {
            d.setWeightDifference(null);
            billingWeight = req.getDispatchWeight();
        }

        d.setSalesAmount(billingWeight.multiply(req.getSellingRate()).setScale(2, RoundingMode.HALF_UP));

        d.setNotes(req.getNotes());
        d.setCreatedBy(req.getCreatedBy());
        deliveryRepository.save(d);

        ledgerService.recordCustomerDebit(customer, req.getDeliveryDate(), LedgerReferenceType.DELIVERY,
                d.getId(), d.getSalesAmount(),
                "Delivery #" + d.getId() + " @ Rs." + d.getSellingRate() + "/kg");

        return toResponse(d);
    }

    public List<DeliveryResponse> findAll() {
        return deliveryRepository.findAll().stream().map(this::toResponse).toList();
    }

    public List<DeliveryResponse> findByCustomer(Long customerId) {
        return deliveryRepository.findByCustomerIdOrderByDeliveryDateDesc(customerId).stream().map(this::toResponse).toList();
    }

    public List<DeliveryResponse> findByDateRange(LocalDate from, LocalDate to) {
        return deliveryRepository.findByDeliveryDateBetweenOrderByDeliveryDateAsc(from, to).stream().map(this::toResponse).toList();
    }

    public List<DeliveryResponse> findByDate(LocalDate date) {
        return deliveryRepository.findByDeliveryDate(date).stream().map(this::toResponse).toList();
    }

    /** Permanently removes a delivery and reverses its effect on the customer's ledger. Admin-only. */
    @org.springframework.transaction.annotation.Transactional
    public void delete(Long id) {
        Delivery d = deliveryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Delivery not found: " + id));
        ledgerService.deleteCustomerLedgerEntryAndRecalculate(d.getCustomer(), com.vpf.entity.enums.LedgerReferenceType.DELIVERY, id);
        deliveryRepository.delete(d);
    }

    public DeliveryResponse toResponse(Delivery d) {
        return DeliveryResponse.builder()
                .id(d.getId())
                .customerId(d.getCustomer().getId())
                .customerName(d.getCustomer().getChickenCenterName())
                .orderId(d.getOrder() != null ? d.getOrder().getId() : null)
                .deliveryDate(d.getDeliveryDate())
                .numberOfBoxes(d.getNumberOfBoxes())
                .numberOfBirds(d.getNumberOfBirds())
                .dispatchWeight(d.getDispatchWeight())
                .receivedWeight(d.getReceivedWeight())
                .weightDifference(d.getWeightDifference())
                .sellingRate(d.getSellingRate())
                .salesAmount(d.getSalesAmount())
                .notes(d.getNotes())
                .createdBy(d.getCreatedBy())
                .createdDate(d.getCreatedDate())
                .build();
    }
}
