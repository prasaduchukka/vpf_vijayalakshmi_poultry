package com.vpf.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "purchase")
public class Purchase extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false)
    private LocalDate purchaseDate;

    private Integer numberOfBirds;

    private Integer numberOfBoxes;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchaseWeight;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal purchaseRate;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal purchaseAmount;

    @Column(length = 1000)
    private String notes;
}
