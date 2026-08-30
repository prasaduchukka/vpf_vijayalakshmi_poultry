package com.vpf.service;

import com.vpf.dto.PurchaseRequest;
import com.vpf.dto.PurchaseResponse;
import com.vpf.entity.Purchase;
import com.vpf.entity.Supplier;
import com.vpf.entity.enums.LedgerReferenceType;
import com.vpf.repository.PurchaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PurchaseService {

    private final PurchaseRepository purchaseRepository;
    private final SupplierService supplierService;
    private final LedgerService ledgerService;

    @Transactional
    public PurchaseResponse create(PurchaseRequest req) {
        Supplier supplier = supplierService.getOrThrow(req.getSupplierId());

        Purchase p = new Purchase();
        p.setSupplier(supplier);
        p.setPurchaseDate(req.getPurchaseDate());
        p.setNumberOfBirds(req.getNumberOfBirds());
        p.setNumberOfBoxes(req.getNumberOfBoxes());
        p.setPurchaseWeight(req.getPurchaseWeight());
        p.setPurchaseRate(req.getPurchaseRate());

        // Default calculation: Purchase Amount = Purchase Weight x Purchase Rate.
        // Admin may override by supplying purchaseAmount explicitly.
        var amount = req.getPurchaseAmount() != null
                ? req.getPurchaseAmount()
                : req.getPurchaseWeight().multiply(req.getPurchaseRate()).setScale(2, RoundingMode.HALF_UP);
        p.setPurchaseAmount(amount);
        p.setNotes(req.getNotes());
        p.setCreatedBy(req.getCreatedBy());
        purchaseRepository.save(p);

        ledgerService.recordSupplierDebit(supplier, req.getPurchaseDate(), LedgerReferenceType.PURCHASE,
                p.getId(), amount, "Purchase #" + p.getId() + " - " + p.getPurchaseWeight() + " kg @ Rs." + p.getPurchaseRate() + "/kg");

        return toResponse(p);
    }

    public List<PurchaseResponse> findAll() {
        return purchaseRepository.findAll().stream().map(this::toResponse).toList();
    }

    public List<PurchaseResponse> findBySupplier(Long supplierId) {
        return purchaseRepository.findBySupplierIdOrderByPurchaseDateDesc(supplierId).stream().map(this::toResponse).toList();
    }

    public List<PurchaseResponse> findByDateRange(LocalDate from, LocalDate to) {
        return purchaseRepository.findByPurchaseDateBetweenOrderByPurchaseDateAsc(from, to).stream().map(this::toResponse).toList();
    }

    /** Permanently removes a purchase and reverses its effect on the supplier's ledger. Admin-only. */
    @org.springframework.transaction.annotation.Transactional
    public void delete(Long id) {
        Purchase p = purchaseRepository.findById(id)
                .orElseThrow(() -> new com.vpf.exception.ResourceNotFoundException("Purchase not found: " + id));
        ledgerService.deleteSupplierLedgerEntryAndRecalculate(p.getSupplier(), com.vpf.entity.enums.LedgerReferenceType.PURCHASE, id);
        purchaseRepository.delete(p);
    }

    public PurchaseResponse toResponse(Purchase p) {
        return PurchaseResponse.builder()
                .id(p.getId())
                .supplierId(p.getSupplier().getId())
                .supplierName(p.getSupplier().getSupplierName())
                .purchaseDate(p.getPurchaseDate())
                .numberOfBirds(p.getNumberOfBirds())
                .numberOfBoxes(p.getNumberOfBoxes())
                .purchaseWeight(p.getPurchaseWeight())
                .purchaseRate(p.getPurchaseRate())
                .purchaseAmount(p.getPurchaseAmount())
                .notes(p.getNotes())
                .createdBy(p.getCreatedBy())
                .createdDate(p.getCreatedDate())
                .build();
    }
}
