function showProductsFromLok()
{
    const location = "[Lok. GrupaMila"
    const products = document.getElementsByClassName("td_product_name")
    for (let i = 0; i < products.length; ++i)
    {
        products[i].innerHTML = products[i].innerHTML.replace(location, "<div class=\"product-to-delete\">" + location + "</div>")
    }
}
function changeSkuVisibility()
{
    const sku_str_reg = /\[SKU #([A-z0-9-]+[^[]])/g
    const products = document.getElementsByClassName("td_product_name")
    for (let i = 0; i < products.length; ++i)
    {
        const original_sku_str = products[i].innerHTML.match(sku_str_reg)
        products[i].innerHTML = products[i].innerHTML.replace(original_sku_str, "<font class=\"product-sku\">" + original_sku_str + "</font>")
    }
}

changeSkuVisibility()
showProductsFromLok()
