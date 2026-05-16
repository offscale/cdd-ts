import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import https from "https";
import http from "http";
import { UserService } from "./user.service.js";
describe('UserService', () => {
    let service: UserService;

    beforeEach(() => {
        service = new UserService('http://localhost:8080/v2');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createUsersWithListInput', () => {
        it('should make a POST request to /user/createWithList', async () => {

            const result = await service.createUsersWithListInput([{ "id": 123, "username": "string-value", "firstName": "string-value", "lastName": "string-value", "email": "string-value", "password": "string-value", "phone": "string-value", "userStatus": 123 }], { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('getUserByName', () => {
        it('should make a GET request to /user/{username}', async () => {

            const result = await service.getUserByName("string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('updateUser', () => {
        it('should make a PUT request to /user/{username}', async () => {

            const result = await service.updateUser("string-value", { "id": 123, "username": "string-value", "firstName": "string-value", "lastName": "string-value", "email": "string-value", "password": "string-value", "phone": "string-value", "userStatus": 123 }, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('deleteUser', () => {
        it('should make a DELETE request to /user/{username}', async () => {

            const result = await service.deleteUser("string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('loginUser', () => {
        it('should make a GET request to /user/login', async () => {

            const result = await service.loginUser("string-value", "string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('logoutUser', () => {
        it('should make a GET request to /user/logout', async () => {

            const result = await service.logoutUser({ headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('createUsersWithArrayInput', () => {
        it('should make a POST request to /user/createWithArray', async () => {

            const result = await service.createUsersWithArrayInput([{ "id": 123, "username": "string-value", "firstName": "string-value", "lastName": "string-value", "email": "string-value", "password": "string-value", "phone": "string-value", "userStatus": 123 }], { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

    describe('createUser', () => {
        it('should make a POST request to /user', async () => {

            const result = await service.createUser({ "id": 123, "username": "string-value", "firstName": "string-value", "lastName": "string-value", "email": "string-value", "password": "string-value", "phone": "string-value", "userStatus": 123 }, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
            expect(result).toBeDefined();
        });
    });

});
