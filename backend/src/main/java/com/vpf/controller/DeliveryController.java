package com.vpf.controller;

import com.vpf.dto.DeliveryRequest;
import com.vpf.service.DeliveryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/deliveries")
@RequiredArgsConstructor
public class DeliveryController {

    private final DeliveryService deliveryService;

    @GetMapping
    public Object findAll(@RequestParam(required = false) Long customerId,
                           @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate from,
                           @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate to) {
        if (customerId != null) return deliveryService.findByCustomer(customerId);
        if (from != null && to != null) return deliveryService.findByDateRange(from, to);
        return deliveryService.findAll();
    }

    @PostMapping
    public Object create(@Valid @RequestBody DeliveryRequest req) {
        return deliveryService.create(req);
    }

    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        deliveryService.delete(id);
    }
}
