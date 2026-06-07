import http from "http";
import https from "https";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreService } from "./store.service.js";

describe("StoreService", () => {
	let service: StoreService;

	beforeEach(() => {
		service = new StoreService("http://localhost:8080/v2");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("getInventory", () => {
		it("should make a GET request to /store/inventory", async () => {
			const result = await service.getInventory({
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("placeOrder", () => {
		it("should make a POST request to /store/order", async () => {
			const result = await service.placeOrder(
				{
					id: 123,
					petId: 123,
					quantity: 123,
					shipDate: "new globalThis.Date()",
					status: "placed",
					complete: true,
				},
				{
					headers: {
						api_key: "special-key",
						Authorization: "Bearer special-key",
					},
				},
			);
			expect(result).toBeDefined();
		});
	});

	describe("getOrderById", () => {
		it("should make a GET request to /store/order/{orderId}", async () => {
			const result = await service.getOrderById("123", {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("deleteOrder", () => {
		it("should make a DELETE request to /store/order/{orderId}", async () => {
			const result = await service.deleteOrder("123", {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});
});
