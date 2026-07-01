console.log("Odpalam skrypt")

function bl_product_amount_improve()
{
    const numbers = document.getElementsByClassName("item-xs item-transparent")
    console.log("Skanuje produkty:", numbers.length)

    for (let i = 0; i < numbers.length; ++i)
    {
        console.log(i, "Analiza: ", numbers[i].textContent)
        var myItem = numbers[i]
        const product_amount = parseInt(myItem.textContent)

        if(myItem.textContent.includes('.'))
        {
            console.log("Pomijam", i)
        }
        else if (product_amount > 1)
        {
            myItem.innerHTML = '&nbsp;' + product_amount + "&nbsp;"
            myItem.classList.add("product-amount")
            myItem.classList.add("amount" + product_amount)
            myItem.classList.remove("item-transparent")
        }
        else
            console.log("Liczba produktów nie pasuje!", product_amount)
    }
    bl_packaging_amount_improve()
    createLinkForMarketPlace()
    bl_szukanie_komentarza()
    setTimeout(function() { bl_product_amount_improve(); }, 1000);
}
// Zwięszkenie widoczności produktów do spakowania
function bl_packaging_amount_improve() {
    const numbers = document.getElementsByClassName("cell_container_product_quantity")
    console.log("Skanuje produkty:", numbers.length)

    for (let i = 0; i < numbers.length; ++i)
    {
        var myItem = numbers[i]
        const product_amount = parseInt(myItem.textContent)
        if (product_amount > 1)
        {
            myItem.innerHTML = '&nbsp;' + product_amount + " sztuki&nbsp;"
            myItem.classList.add("product-amount-big")
            myItem.classList.add("amount" + product_amount)
            // myItem.classList.remove("item-transparent")
        }
    }
}
function bl_szukanie_komentarza()
{
    const order_infos = document.getElementsByClassName("pick_pack_sale_detail_info")
    for (let i = 0; i < order_infos.length; ++i) {
        var myItem = order_infos[i]
        const comment_ico = myItem.getElementsByClassName("fa-comment")
        if (comment_ico.length > 0)
        {
            myItem.classList.add("client-comment")
        }
    }
}
function createLinkForMarketPlace()
{
    const marketplaceLink = document.getElementById("sale_info_extra_field_41294")

    if(marketplaceLink) {
        marketplaceLink.setAttribute("onclick", "window.open(='" + marketplaceLink.innerText + "')")

        const marketplaceButton = document.getElementsByClassName("btn_personal_trigger_43795 ");
        const onClickAction = "window.open('" + marketplaceLink.innerText + "')";
        if (marketplaceButton[0] && marketplaceButton[0].getAttribute("onclick") !== onClickAction) {
            console.log("Tworzę odninośnik do marketplace.")
            marketplaceButton[0].setAttribute("onclick", onClickAction)
        }
    }
}
function showProductsFromLok()
{
    const location = "GrupaMila Sp z.o.o"
    const products = document.getElementsByClassName("td_product_name")
    for (let i = 0; i < products.length; ++i)
    {
        products[i].innerHTML.replace(location, "<a class=\"product-to-delete\"" + location + "</a>")
    }
    console.log("Found items: " , products.length)
}



window.onload = function myMain (evt) {
    setTimeout(function() { bl_product_amount_improve(); }, 1000);
}
