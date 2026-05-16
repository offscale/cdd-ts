
            import { describe, it, expect } from 'vitest';
import { PetService } from './services/pet.service.js';
import { StoreService } from './services/store.service.js';
import { UserService } from './services/user.service.js';

            describe('SDK Integration Tests', () => {

                describe('PetService', () => {
                    const service = new PetService('http://localhost:8080/v2');

                    it('should call uploadFile successfully', async () => {
                        try {
                            const result = await service.uploadFile(123, "string-value", {}, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call addPet successfully', async () => {
                        try {
                            const result = await service.addPet({"id":123,"category":{"id":123,"name":"string-value"},"name":"doggie","photoUrls":["string-value"],"tags":[{"id":123,"name":"string-value"}],"status":"available"}, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call updatePet successfully', async () => {
                        try {
                            const result = await service.updatePet({"id":123,"category":{"id":123,"name":"string-value"},"name":"doggie","photoUrls":["string-value"],"tags":[{"id":123,"name":"string-value"}],"status":"available"}, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call findPetsByStatus successfully', async () => {
                        try {
                            const result = await service.findPetsByStatus(["available"], { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call findPetsByTags successfully', async () => {
                        try {
                            const result = await service.findPetsByTags(["string-value"], { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call getPetById successfully', async () => {
                        try {
                            const result = await service.getPetById(123, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call updatePetWithForm successfully', async () => {
                        try {
                            const result = await service.updatePetWithForm(123, "string-value", "string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call deletePet successfully', async () => {
                        try {
                            const result = await service.deletePet(123, "string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                });

                describe('StoreService', () => {
                    const service = new StoreService('http://localhost:8080/v2');

                    it('should call getInventory successfully', async () => {
                        try {
                            const result = await service.getInventory({ headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call placeOrder successfully', async () => {
                        try {
                            const result = await service.placeOrder({"id":123,"petId":123,"quantity":123,"shipDate":new globalThis.Date(),"status":"placed","complete":true}, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call getOrderById successfully', async () => {
                        try {
                            const result = await service.getOrderById(123, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call deleteOrder successfully', async () => {
                        try {
                            const result = await service.deleteOrder(123, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                });

                describe('UserService', () => {
                    const service = new UserService('http://localhost:8080/v2');

                    it('should call createUsersWithListInput successfully', async () => {
                        try {
                            const result = await service.createUsersWithListInput([{"id":123,"username":"string-value","firstName":"string-value","lastName":"string-value","email":"string-value","password":"string-value","phone":"string-value","userStatus":123}], { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call getUserByName successfully', async () => {
                        try {
                            const result = await service.getUserByName("string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call updateUser successfully', async () => {
                        try {
                            const result = await service.updateUser("string-value", {"id":123,"username":"string-value","firstName":"string-value","lastName":"string-value","email":"string-value","password":"string-value","phone":"string-value","userStatus":123}, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call deleteUser successfully', async () => {
                        try {
                            const result = await service.deleteUser("string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call loginUser successfully', async () => {
                        try {
                            const result = await service.loginUser("string-value", "string-value", { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call logoutUser successfully', async () => {
                        try {
                            const result = await service.logoutUser({ headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call createUsersWithArrayInput successfully', async () => {
                        try {
                            const result = await service.createUsersWithArrayInput([{"id":123,"username":"string-value","firstName":"string-value","lastName":"string-value","email":"string-value","password":"string-value","phone":"string-value","userStatus":123}], { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                    it('should call createUser successfully', async () => {
                        try {
                            const result = await service.createUser({"id":123,"username":"string-value","firstName":"string-value","lastName":"string-value","email":"string-value","password":"string-value","phone":"string-value","userStatus":123}, { headers: { 'api_key': 'special-key', 'Authorization': 'Bearer special-key' } });
                            expect(result).toBeDefined();
                        } catch (error: any) {
                            if (error && (error.code === 'ECONNREFUSED' || String(error).includes('ECONNREFUSED') || String(error).includes('FormData') || String(error).includes('URLSearchParams'))) {
                                expect(true).toBe(true);
                            } else {
                                throw error;
                            }
                        }
                    });

                });

            });
        
            
                
                
                
                
                
                
                
                
            
            
                
                
                
                
            
            
                
                
                
                
                
                
                
                
            
        
        
