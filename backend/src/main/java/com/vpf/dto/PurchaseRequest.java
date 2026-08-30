package com.vpf.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PurchaseRequest {
    @NotNull
    private Long supplierId;
    @NotNull
    private LocalDate purchaseDate;
    private Integer numberOfBirds;
    private Integer numberOfBoxes;
    @NotNull
    @Positive
    private BigDecimal purchaseWeight;
    @NotNull
    @Positive
    private BigDecimal purchaseRate;
    /** Optional: if omitted, calculated as purchaseWeight * purchaseRate. Admin can override. */
    private BigDecimal purchaseAmount;
    private String notes;
    private String createdBy;
}
