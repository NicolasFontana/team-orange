import { ProductDB, Product, ProductInterface } from "../models/product";
import { MySqlConnection } from "../core/mysql/mysql.connection";
import { DependencyContainer, DependencyLifeTime, Injectable } from "@miracledevs/paradigm-web-di";
import { EditRepositoryBase } from "../core/repositories/edit.repository";
import { BrandRepository } from "../repositories/brand.repository";
import { CategoryRepository } from "../repositories/category.repository";
import { SizeRepository } from "../repositories/size.repository";
import { ProductCategoryRepository } from "../repositories/productCategory.repository";
import { ProductSizeRepository } from "../repositories/productSize.repository";
import { InsertionResult } from "../core/repositories/commands/db.command";
import { RowDataPacket } from "mysql2/promise";
import { ProductRepository } from "./product.repository";

@Injectable({ lifeTime: DependencyLifeTime.Scoped })
export class ProductDBRepository extends EditRepositoryBase<ProductDB> {
    constructor(
        dependecyContainer: DependencyContainer,
        connection: MySqlConnection,
        private productRepo: ProductRepository,
        private brandRepo: BrandRepository,
        private categoryRepo: CategoryRepository,
        private sizeRepo: SizeRepository,
        private productCategoryRepo: ProductCategoryRepository,
        private productSizeRepo: ProductSizeRepository
    ) {
        super(dependecyContainer, connection, ProductDB, "product");
    }

    async insertProduct(product: Product, id: number): Promise<InsertionResult<number>> {
        const { categories, sizes, brand, ...rest } = product;
        const brandName = await this.brandRepo.find({ name: brand });
        if (!brandName) throw new Error("No brand with that name");
        const result = await this.insertOne({
            ...rest,
            storeId: id,
            brandId: brandName[0].id,
        });
        if (!result.insertId) throw new Error("Product creation failed");
        for (const category of categories) {
            const categoryResponse = await this.categoryRepo.find({ name: category });
            if (categoryResponse.length < 1) throw new Error("Invalid category");
            await this.productCategoryRepo.insertOne({
                productId: result.insertId,
                categoryId: categoryResponse[0].id,
            });
        }
        for (const size of sizes) {
            const sizeResponse = await this.sizeRepo.find({ name: size });
            if (sizeResponse.length < 1) throw new Error("Invalid size");
            await this.productSizeRepo.insertOne({
                productId: result.insertId,
                sizeId: sizeResponse[0].id,
            });
        }
        return result;
    }

    async updateProduct(entity: ProductInterface) {
        const { categories, sizes, brand, ...rest } = entity;
        const brandName = await this.brandRepo.find({ name: brand });
        //prevent changing product store
        delete rest.storeId;
        await this.update({ brandId: brandName[0].id, ...rest });
        const product = await this.productRepo.getById(entity.id);
        if (!product) throw new Error("Product not found");

        if (entity.categories.length !== product.categories.length || entity.categories.some((val, index) => val !== product.categories[index])) {
            await this.productCategoryRepo.delete({ productId: entity.id });
            for (const category of categories) {
                const categoryResponse = await this.categoryRepo.find({ name: category });
                if (categoryResponse.length < 1) throw new Error("Invalid category");
                await this.productCategoryRepo.insertOne({ productId: entity.id, categoryId: categoryResponse[0].id });
            }
        }

        if (entity.sizes.length !== product.sizes.length || entity.sizes.some((val, index) => val !== product.sizes[index])) {
            await this.productSizeRepo.delete({ productId: entity.id });
            for (const size of sizes) {
                const sizeResponse = await this.sizeRepo.find({ name: size });
                if (sizeResponse.length < 1) throw new Error("Invalid size");
                await this.productSizeRepo.insertOne({ productId: entity.id, sizeId: sizeResponse[0].id });
            }
        }
    }

    async getManager(idProduct: number): Promise<string> {
        const [product] = await this.connection.connection.query<RowDataPacket[]>(
            "SELECT email FROM product p JOIN store s ON s.id = p.storeId JOIN user u ON u.id = s.managerId WHERE p.id = ?",
            [idProduct]
        );
        if (product.length === 0) throw new Error("Manager email not found");
        return product[0].email;
    }
}
