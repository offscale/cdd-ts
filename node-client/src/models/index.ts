export interface ApiResponse {
    /** @format int32 */
    code?: number;
    type?: string;
    message?: string;
}

/** @xml {"name":"Category"} */
export interface Category {
    /** @format int64 */
    id?: number;
    name?: string;
}

/** @xml {"name":"Pet"} */
export interface Pet {
    /** @format int64 */
    id?: number;
    category?: Category;
    /** @example "doggie" */
    name: string;
    /** @xml {"wrapped":true} */
    photoUrls: string[];
    /** @xml {"wrapped":true} */
    tags?: Tag[];
    /** pet status in the store */
    status?: 'available' | 'pending' | 'sold';
}

/** @xml {"name":"Tag"} */
export interface Tag {
    /** @format int64 */
    id?: number;
    name?: string;
}

/** @xml {"name":"Order"} */
export interface Order {
    /** @format int64 */
    id?: number;
    /** @format int64 */
    petId?: number;
    /** @format int32 */
    quantity?: number;
    /** @format date-time */
    shipDate?: Date;
    /** Order Status */
    status?: 'placed' | 'approved' | 'delivered';
    complete?: boolean;
}

/** @xml {"name":"User"} */
export interface User {
    /** @format int64 */
    id?: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
    /**
     * User Status
     * @format int32
     */
    userStatus?: number;
}

/** Response headers for operation 'loginUser' with status 200. */
export interface LoginUser200Headers {
    /** date in UTC when token expires */
    'X-Expires-After'?: Date;
    /** calls per hour allowed by the user */
    'X-Rate-Limit'?: number;
}
