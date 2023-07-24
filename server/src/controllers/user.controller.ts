import { Action, ApiController, Controller, HttpMethod } from "@miracledevs/paradigm-express-webapi";
import { UserRepository } from "../repositories/user.repository";
import { UserI } from "../models/user";
import { UserFilter } from "../filters/user.filter";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Path, PathParam, QueryParam, GET, POST, DELETE, PUT } from "typescript-rest";
import { Response, Tags } from "typescript-rest-swagger";

interface ResponseMessage {
    message: string;
    data: UserI | UserI[] | null;
    error: boolean;
}

@Path("/api/users")
@Tags("Users")
@Controller({ route: "/api/users" })
export class UserController extends ApiController {
    constructor(private userRepo: UserRepository) {
        super();
    }

    /**
     * Produce an user with a given email
     * @example
     * url/q?email="test@email.com"
     * @returns
     * User {
     *        id: number;
     *        name: string;
     *        lastName: string;
     *        email: string;
     *        password?: string;
     *        idDocumentType: string;
     *        idDocumentNumber: number;
     *        rol: string;
     *        status: number;
     *      }
     */
    @GET
    @Path("/q")
    @Response<ResponseMessage>(200, "Retrieve an User.", {
        message: "User found",
        data: {
            id: 1,
            name: "John",
            lastName: "Doe",
            email: "john@email.com",
            password: "123johnDoe",
            idDocumentType: "DNI",
            idDocumentNumber: 12345678,
            rol: "client",
            status: 1,
        },
        error: false,
    })
    @Response<ResponseMessage>(404, "User not found.", { message: "User not found", data: null, error: true })
    @Action({ route: "/q", query: ":email", method: HttpMethod.GET })
    async getByEmail(@QueryParam("email") email: string) {
        try {
            //const { email } = this.httpContext.request.query;
            const user = await this.userRepo.find(["email"], [email]);
            return this.httpContext.response.status(200).json({
                message: "User found",
                data: user,
                error: false,
            });
        } catch (error) {
            return this.httpContext.response.status(404).json({
                message: "User not found",
                data: null,
                error: true,
            });
        }
    }
    /**
     * UPDATES an user
     * @param user
     * @returns
     *
     * @example
     * User {
     *          id: 1;
     *          name: "John";
     *          lastName: "Doe";
     *          email: "john@email.com";
     *          password: "123johnDoe";
     *          idDocumentType: "DNI";
     *          idDocumentNumber: 12345678;
     *          rol: "client";
     *          status: true;
     *      }
     */
    @PUT
    @Path("/")
    @Response<ResponseMessage>(200, "Updates an User.", {
        message: "User updated",
        data: {
            id: 1,
            name: "John",
            lastName: "Doe",
            email: "john@email.com",
            password: "123johnDoe",
            idDocumentType: "DNI",
            idDocumentNumber: 12345678,
            rol: "client",
            status: 1,
        },
        error: false,
    })
    @Response<ResponseMessage>(404, "User not found.", { message: "User not found", data: null, error: true })
    @Action({ route: "/", filters: [UserFilter], fromBody: true, method: HttpMethod.PUT })
    async update(user: UserI) {
        try {
            const result = await this.userRepo.update(user);
            return this.httpContext.response.status(201).json({
                message: "User updated",
                data: result,
                error: false,
            });
        } catch (error) {
            return this.httpContext.response.status(404).json({
                message: "User " + error.message,
                data: null,
                error: true,
            });
        }
    }

    /**
     * CREATES an user
     * @param user
     * @returns
     *
     * @example
     * User {
     *          id: 1;
     *          name: "John";
     *          lastName: "Doe";
     *          email: "john@email.com";
     *          password: "123johnDoe";
     *          idDocumentType: "DNI";
     *          idDocumentNumber: 12345678;
     *          rol: "client";
     *          status: true;
     *      }
     */
    @POST
    @Path("/")
    @Response<ResponseMessage>(200, "Creates an User.", {
        message: "User created",
        data: {
            id: 1,
            name: "John",
            lastName: "Doe",
            email: "john@email.com",
            password: "123johnDoe",
            idDocumentType: "DNI",
            idDocumentNumber: 12345678,
            rol: "client",
            status: 1,
        },
        error: true,
    })
    @Response<ResponseMessage>(500, "Duplicate Email.", { message: "Email already exists", data: null, error: true })
    @Response<ResponseMessage>(500, "Duplicate idDocumentNumber.", { message: "Duplicated Email", data: null, error: true })
    @Response<ResponseMessage>(500, "Server Error.", { message: "Failed to create user", data: null, error: true })
    @Action({ route: "/", filters: [UserFilter], fromBody: true, method: HttpMethod.POST })
    async post(user: UserI) {
        try {
            user.password = await bcrypt.hash(user.password, 10);
            await this.userRepo.insertOne(user);
            delete user.password;
            const token = jwt.sign(user, process.env.SHOPPY__ACCESS_TOKEN, { expiresIn: "30d" });
            this.httpContext.response.cookie("token", token, { httpOnly: true });
            return this.httpContext.response.status(201).json({
                message: "User created",
                data: user,
                error: false,
            });
        } catch (error) {
            let message = "Failed to create user";
            if (error.code === "ER_DUP_ENTRY" && error.sqlMessage.includes("email")) {
                message = "Email already exists";
            } else if (error.code === "ER_DUP_ENTRY" && error.sqlMessage.includes("idDocumentNumber")) {
                message = "ID document number already exists";
            }
            return this.httpContext.response.status(500).json({
                message: message,
                data: null,
                error: true,
            });
        }
    }

    /**
     * Logins an user with a given email and password
     * @param user - {email: string, password: string}
     * @returns
     */
    @POST
    @Path("/login")
    @Response<ResponseMessage>(200, "Logins an user.", {
        message: "Login successful",
        data: {
            id: 1,
            name: "John",
            lastName: "Doe",
            email: "john@email.com",
            password: "123johnDoe",
            idDocumentType: "DNI",
            idDocumentNumber: 12345678,
            rol: "client",
            status: 1,
        },
        error: false,
    })
    @Response<ResponseMessage>(401, "Incorrect username or password.", { message: "Incorrect username or password", data: null, error: true })
    @Response<ResponseMessage>(401, "User not found.", { message: "User not found", data: null, error: true })
    @Action({ route: "/login", fromBody: true, method: HttpMethod.POST })
    async login(user: UserI) {
        try {
            const [userdb] = await this.userRepo.find(["email"], [user.email]);
            if (!userdb) {
                return this.httpContext.response.status(401).json({
                    message: "Incorrect username or password",
                    data: undefined,
                    error: true,
                });
            }
            const isPasswordValid = await bcrypt.compare(user.password, userdb.password);
            if (!isPasswordValid) {
                return this.httpContext.response.status(401).json({
                    message: "Incorrect username or password",
                    data: undefined,
                    error: true,
                });
            }
            delete userdb.password;
            const { ...userobj } = userdb;
            const token = jwt.sign(userobj, process.env.SHOPPY__ACCESS_TOKEN, { expiresIn: "30d" });
            this.httpContext.response.cookie("token", token, { httpOnly: true });
            return this.httpContext.response.status(200).json({
                message: "Login successful",
                data: userdb,
                error: false,
            });
        } catch (error) {
            console.log(error.message);
            return this.httpContext.response.status(404).json({
                message: "User not found",
                data: null,
                error: true,
            });
        }
    }
    /**
     * DELETE an user
     * @param id
     * @returns
     */
    @DELETE
    @Path("/:id")
    @Response<ResponseMessage>(200, "User deleted.", {
        message: "User deleted",
        data: {
            id: 1,
            name: "John",
            lastName: "Doe",
            email: "john@email.com",
            password: "123johnDoe",
            idDocumentType: "DNI",
            idDocumentNumber: 12345678,
            rol: "client",
            status: 1,
        },
        error: false,
    })
    @Response<ResponseMessage>(404, "User not found.", { message: "User not found", data: null, error: true })
    @Action({ route: "/:id", method: HttpMethod.DELETE })
    async delete(@PathParam("id") id: number) {
        try {
            const user = await this.userRepo.getById(id);
            user.status = 0;
            const userDeleted = await this.userRepo.update(user);
            return this.httpContext.response.status(200).json({
                message: "User deleted",
                data: userDeleted,
                error: false,
            });
        } catch (error) {
            return this.httpContext.response.status(404).json({
                message: "User not found",
                data: null,
                error: true,
            });
        }
    }

    /**
     * GET an user with a given id
     * @param id
     * @returns
     */
    @GET
    @Path("/:id")
    @Response<ResponseMessage>(200, "Retrieve an User.", {
        message: "User found",
        data: {
            id: 1,
            name: "John",
            lastName: "Doe",
            email: "john@email.com",
            password: "123johnDoe",
            idDocumentType: "DNI",
            idDocumentNumber: 12345678,
            rol: "client",
            status: 1,
        },
        error: false,
    })
    @Response<ResponseMessage>(404, "User not found.", { message: "User not found", data: null, error: true })
    @Action({ route: "/:id", method: HttpMethod.GET })
    async getById(@PathParam("id") id: number) {
        try {
            const user = await this.userRepo.getById(Number(id));
            return this.httpContext.response.status(200).json({
                message: "User found",
                data: user,
                error: false,
            });
        } catch (error) {
            return this.httpContext.response.status(404).json({
                message: "User not found",
                data: null,
                error: true,
            });
        }
    }

    /**
     * Produce a list of all users
     * @returns a list of all users
     */
    @GET
    @Path("/")
    @Response<ResponseMessage>(200, "Retrieve a list of all Users.", {
        message: "Users found",
        data: [
            {
                id: 1,
                name: "John",
                lastName: "Doe",
                email: "john@email.com",
                password: "123johnDoe",
                idDocumentType: "DNI",
                idDocumentNumber: 12345678,
                rol: "client",
                status: 1,
            },
        ],
        error: false,
    })
    @Response<ResponseMessage>(404, "Users not found.", { message: "Users not found", data: null, error: true })
    @Action({ route: "/", method: HttpMethod.GET })
    async getAll() {
        try {
            const users = await this.userRepo.getAll();
            return this.httpContext.response.status(200).json({
                message: "Users found",
                data: users,
                error: false,
            });
        } catch (error) {
            return this.httpContext.response.status(404).json({
                message: "Users not found",
                data: null,
                error: true,
            });
        }
    }
}
