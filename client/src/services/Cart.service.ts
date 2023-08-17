import { baseEndpoints } from "../endpoints";
import { ItemCart } from "../types";
import Fetcher from "./Fetcher";
export class CartService {
    async checkout(cart: ItemCart[]) {
        try {
            const products = cart.map(item => ({ ...item.product, quantity: item.amount }));
            const product = await Fetcher.query(`${baseEndpoints.checkout.produce}`, {
                method: "POST",
                data: products,
            });
            return product.data;
        } catch (e) {
            console.log(e);
        }
    }
}
