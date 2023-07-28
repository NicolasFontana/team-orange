import { Action, ApiController, Controller, HttpMethod } from "@miracledevs/paradigm-express-webapi";
import { UserRepository } from "../repositories/user.repository";
import { UserI, UserL } from "../models/user";
import { UserFilter } from "../filters/user.filter";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Path, PathParam, GET, POST, DELETE, PUT, Security } from "typescript-rest";
import { Response, Tags } from "typescript-rest-swagger";
import { LoginFilter } from "../filters/login.filter";
import { JWTAuth } from "../filters/jwtAuth";

@Path("/api/users")
@Tags("Users")
@Controller({ route: "/api/users" })
export class UserController extends ApiController {
    constructor(private userRepo: UserRepository) {
        super();
    }

    /**
     * UPDATES an user
     * entity: UserI - The user to delete
     * decodedToken: UserI - It's the token each user get when they login or signup
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
    @Path("/update")
    @Response<UserI>(200, "Updates an User.")
    @Response(404, "User not found.")
    @Action({ route: "/update", filters: [UserFilter, JWTAuth], fromBody: true, method: HttpMethod.PUT })
    async update({ entity, decodedToken }: { entity: UserI; decodedToken: UserI }) {
        try {
            if (entity.id !== decodedToken.id) throw new Error("Unauthorized");
            entity.password = await bcrypt.hash(entity.password, 10);
            const newUser = {
                ...decodedToken,
                name: entity.name,
                lastName: entity.lastName,
                email: entity.email,
                password: entity.password,
            };
            const result = await this.userRepo.update(newUser);
            delete result.password;
            return this.httpContext.response.status(201).json({
                message: "User updated",
                data: result,
                error: false,
            });
        } catch (error) {
            if (error.message === "Unauthorized") {
                return this.httpContext.response.status(401).json({
                    message: error.message,
                    data: null,
                    error: true,
                });
            }
            return this.httpContext.response.status(404).json({
                message: "User " + error.message,
                data: null,
                error: true,
            });
        }
    }

    /**
     * CREATES an user
     * entity: UserI - The user to delete
     * decodedToken: UserI - It's the token each user get when they login or signup
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
    @Path("/signup")
    @Response<UserI>(200, "Creates an User.")
    @Response(500, "Duplicate Email.")
    @Response(500, "Duplicate idDocumentNumber.")
    @Response(500, "Server Error.")
    @Action({ route: "/signup", filters: [UserFilter], fromBody: true, method: HttpMethod.POST })
    async post(user: UserI) {
        try {
            user.password = await bcrypt.hash(user.password, 10);
            const { insertId } = await this.userRepo.insertOne(user);
            delete user.password;
            const userCreated = { id: insertId, ...user };
            const token = jwt.sign(userCreated, process.env.SHOPPY__ACCESS_TOKEN, { expiresIn: "30d" });
            this.httpContext.response.setHeader("x-auth", token);
            return this.httpContext.response.status(201).json({
                message: "User created",
                data: userCreated,
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
    @Response<UserI>(200, "Logins an user.")
    @Response(401, "Incorrect username or password.")
    @Response(401, "User not found.")
    @Action({ route: "/login", fromBody: true, method: HttpMethod.POST, filters: [LoginFilter] })
    async login(user: UserL) {
        try {
            const [userdb] = await this.userRepo.find({ email: user.email });
            if (!userdb || userdb.status === 0) {
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
            this.httpContext.response.setHeader("x-auth", token);
            return this.httpContext.response.status(200).json({
                message: "Login successful",
                data: userdb,
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
     * DELETE an user
     * entity: UserI - The user to delete
     * decodedToken: UserI - It's the token each user get when they login or signup
     * @param id
     * @returns
     */
    @DELETE
    @Path("/")
    @Response<UserI>(200, "User deleted.")
    @Response(404, "User not found.")
    @Action({ route: "/", method: HttpMethod.DELETE, fromBody: true, filters: [JWTAuth] })
    async delete({ entity, decodedToken }: { entity: UserI; decodedToken: UserI }) {
        try {
            if (entity.id !== decodedToken.id && decodedToken.rol !== "Admin") throw new Error("Unauthorized");
            const [userdb] = await this.userRepo.find({ id: Number(entity.id), status: 1 });
            if (!userdb) throw new Error("User not found");
            if (decodedToken.rol !== "Admin" && !(await bcrypt.compare(entity.password, userdb.password))) throw new Error("Unauthorized");
            userdb.status = 0;
            const userDeleted = await this.userRepo.update(userdb);
            delete userDeleted.password;
            return this.httpContext.response.status(200).json({
                message: "User deleted",
                data: userDeleted,
                error: false,
            });
        } catch (error) {
            if (error.message === "Unauthorized" || error.message === "data and hash arguments required") {
                return this.httpContext.response.status(401).json({
                    message: "Unauthorized",
                    data: null,
                    error: true,
                });
            }
            if (error.message === "User not found") {
                return this.httpContext.response.status(404).json({
                    message: error.message,
                    data: null,
                    error: true,
                });
            }
            return this.httpContext.response.status(500).json({
                message: error.message,
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
    @Response<UserI>(200, "Retrieve an User.")
    @Response(404, "User not found.")
    @Action({ route: "/:id", method: HttpMethod.GET })
    async getById(@PathParam("id") id: number) {
        try {
            const user = await this.userRepo.getById(Number(id));
            delete user.password;
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
     * decodedToken: UserI - It's the token each user get when they login or signup
     * @returns a list of all users
     */
    @GET
    @Path("/")
    @Security("Admin")
    @Response<UserI[]>(200, "Retrieve a list of all Users.")
    @Response(401, "Unauthorized")
    @Response(404, "Users not found.")
    @Action({ route: "/", method: HttpMethod.GET, filters: [JWTAuth] })
    async getAll() {
        try {
            const { id } = this.httpContext.request.body.decodedToken;
            const user = await this.userRepo.getById(id);
            if (user.rol !== "Admin") throw new Error("Unauthorized");
            const users = await this.userRepo.getBy(["name", "lastName", "email", "idDocumentType", "idDocumentNumber", "rol", "status"]);
            return this.httpContext.response.status(200).json({
                message: "Users found",
                data: users,
                error: false,
            });
        } catch (error) {
            if (error.message === "Unauthorized") {
                return this.httpContext.response.status(401).json({
                    message: error.message,
                    data: null,
                    error: true,
                });
            }
            return this.httpContext.response.status(404).json({
                message: "Users not found",
                data: null,
                error: true,
            });
        }
    }

    /**
     * RESTORE an user
     * entity: UserI - The user to restore
     * decodedToken: UserI - It's the token each user get when they login or signup
     * @param id
     * @returns
     */
    @PUT
    @Path("/restore")
    @Response<UserI>(200, "User restored.")
    @Response(401, "Unauthorized")
    @Response(404, "User not found.")
    @Action({ route: "/restore", method: HttpMethod.PUT, fromBody: true, filters: [JWTAuth] })
    async restore({ entity, decodedToken }: { entity: UserI; decodedToken: UserI }) {
        try {
            if (entity.id === decodedToken.id || decodedToken.rol !== "Admin") throw new Error("Unauthorized");
            const [userdb] = await this.userRepo.find({ id: Number(entity.id), status: 0 });
            if (!userdb) throw new Error("User not found");
            userdb.status = 1;
            const userRestored = await this.userRepo.update(userdb);
            delete userRestored.password;
            return this.httpContext.response.status(200).json({
                message: "User restored",
                data: userRestored,
                error: false,
            });
        } catch (error) {
            if (error.message === "Unauthorized") {
                return this.httpContext.response.status(401).json({
                    message: error.message,
                    data: null,
                    error: true,
                });
            }
            if (error.message === "User not found") {
                return this.httpContext.response.status(404).json({
                    message: error.message,
                    data: null,
                    error: true,
                });
            }
            return this.httpContext.response.status(500).json({
                message: error.message,
                data: null,
                error: true,
            });
        }
    }
}
