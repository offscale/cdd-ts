import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import https from "https";
import http from "http";
import { PetService } from "./pet.service.js";
describe("PetService", () => {
	let service: PetService;

	beforeEach(() => {
		service = new PetService("http://localhost:8080/v2");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("uploadFile", () => {
		it("should make a POST request to /pet/{petId}/uploadImage", async () => {
			const result = await service.uploadFile("123", {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("addPet", () => {
		it("should make a POST request to /pet", async () => {
			const result = await service.addPet(
				{
					id: 123,
					category: { id: 123, name: "string-value" },
					name: "doggie",
					photoUrls: ["string-value"],
					tags: [{ id: 123, name: "string-value" }],
					status: "available",
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

	describe("updatePet", () => {
		it("should make a PUT request to /pet", async () => {
			const result = await service.updatePet(
				{
					id: 123,
					category: { id: 123, name: "string-value" },
					name: "doggie",
					photoUrls: ["string-value"],
					tags: [{ id: 123, name: "string-value" }],
					status: "available",
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

	describe("findPetsByStatus", () => {
		it("should make a GET request to /pet/findByStatus", async () => {
			const result = await service.findPetsByStatus(["available"], {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("findPetsByTags", () => {
		it("should make a GET request to /pet/findByTags", async () => {
			const result = await service.findPetsByTags(["string-value"], {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("getPetById", () => {
		it("should make a GET request to /pet/{petId}", async () => {
			const result = await service.getPetById("123", {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("updatePetWithForm", () => {
		it("should make a POST request to /pet/{petId}", async () => {
			const result = await service.updatePetWithForm("123", {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});

	describe("deletePet", () => {
		it("should make a DELETE request to /pet/{petId}", async () => {
			const result = await service.deletePet("123", {
				headers: {
					api_key: "special-key",
					Authorization: "Bearer special-key",
				},
			});
			expect(result).toBeDefined();
		});
	});
});
