package com.vpf.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class DeliveryResponse {
    private Long id;
    private Long customerId;
    private String customerName;
    private Long orderId;
    private LocalDate deliveryDate;
    private Integer numberOfBoxes;
    private Integer numberOfBirds;
    private BigDecimal dispatchWeight;
    private BigDecimal receivedWeight;
    private BigDecimal weightDifference;
    private BigDecimal sellingRate;
    private BigDecimal salesAmount;
    private String notes;
    private String createdBy;
    private LocalDateTime createdDate;
}
