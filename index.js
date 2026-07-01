(() => {
    "use strict";

    const VERSION = "1.3.0";
    const WATCHDOG_INTERVAL_MS = 2000;
    const PACK_MODAL_ID = "sales_pick_pack_modal";
    const PACK_MODAL_BODY_ID = "sales_pick_pack_modal_body";
    const PACK_ROW_SELECTOR =
        ".pick_pack_product_row:not(#pick_pack_product_row_template)";
    const PACK_QUANTITY_SELECTOR =
        `${PACK_ROW_SELECTOR} .cell_container_product_quantity`;
    const PACK_ALERT_CLASS = "gm-product-quantity-alert";
    const PACK_ROW_ALERT_CLASS = "gm-multi-quantity-row";
    const PACK_ITEMS_CONTAINER_SELECTOR = ".pick_pack_sale_items_container";
    const PACK_ITEMS_SCROLLER_SELECTOR =
        `${PACK_ITEMS_CONTAINER_SELECTOR} .pick_pack_sale_items.scroll-content`;
    const PACK_SCROLL_WARNING_CLASS = "gm-more-products-warning";
    const PACK_SCROLL_HOST_CLASS = "gm-more-products-below";
    const SCROLL_BOTTOM_THRESHOLD_PX = 12;

    let observedPackModal = null;
    let packObserver = null;
    let packScanScheduled = false;
    let generalScanScheduled = false;
    let scrollCheckScheduled = false;
    let lastOrderSignature = "";
    let observedItemsScroller = null;
    let itemsResizeObserver = null;

    function normalizeText(value) {
        return (value || "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function parseQuantity(element) {
        const rawValue = normalizeText(element.textContent).replace(",", ".");
        const match = rawValue.match(/\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : Number.NaN;
    }

    function setPackagingAlert(quantityElement) {
        const quantity = parseQuantity(quantityElement);
        const shouldHighlight = Number.isFinite(quantity) && quantity > 1;
        const row = quantityElement.closest(PACK_ROW_SELECTOR);

        quantityElement.classList.toggle(PACK_ALERT_CLASS, shouldHighlight);
        row?.classList.toggle(PACK_ROW_ALERT_CLASS, shouldHighlight);

        if (shouldHighlight) {
            const normalizedQuantity = Number.isInteger(quantity)
                ? String(quantity)
                : String(quantity).replace(".", ",");

            quantityElement.dataset.gmQuantity = normalizedQuantity;
            quantityElement.title = `UWAGA: spakuj ${normalizedQuantity} szt.`;
            quantityElement.setAttribute(
                "aria-label",
                `Uwaga, do spakowania ${normalizedQuantity} sztuki produktu`
            );
        } else {
            delete quantityElement.dataset.gmQuantity;
            quantityElement.removeAttribute("title");
            quantityElement.removeAttribute("aria-label");
        }
    }

    function enhancePackagingQuantities() {
        const packBody = document.getElementById(PACK_MODAL_BODY_ID);
        if (!packBody) {
            return;
        }

        packBody
            .querySelectorAll(PACK_QUANTITY_SELECTOR)
            .forEach(setPackagingAlert);

        // Sprzątanie, gdy Base.com ponownie wykorzysta element albo zmieni strukturę wiersza.
        packBody
            .querySelectorAll(`.${PACK_ALERT_CLASS}`)
            .forEach((element) => {
                if (!element.matches(PACK_QUANTITY_SELECTOR)) {
                    element.classList.remove(PACK_ALERT_CLASS);
                    delete element.dataset.gmQuantity;
                    element.removeAttribute("title");
                    element.removeAttribute("aria-label");
                    element
                        .closest(PACK_ROW_SELECTOR)
                        ?.classList.remove(PACK_ROW_ALERT_CLASS);
                }
            });
    }

    function getPackagingItemsScroller() {
        const packBody = document.getElementById(PACK_MODAL_BODY_ID);
        if (!packBody) {
            return null;
        }

        const candidates = Array.from(
            packBody.querySelectorAll(PACK_ITEMS_SCROLLER_SELECTOR)
        );

        return candidates.find((element) =>
            element.clientHeight > 0 &&
            element.scrollHeight > element.clientHeight + 1
        ) || candidates.find((element) => element.clientHeight > 0) || null;
    }

    function getHiddenProductRowsCount(scroller) {
        const viewportBottom = scroller.getBoundingClientRect().bottom;

        return Array.from(scroller.querySelectorAll(PACK_ROW_SELECTOR))
            .filter((row) => {
                const rect = row.getBoundingClientRect();
                return rect.height > 0 && rect.bottom > viewportBottom + 2;
            })
            .length;
    }

    function ensureScrollWarningElement(host) {
        let warning = host.querySelector(`:scope > .${PACK_SCROLL_WARNING_CLASS}`);
        if (warning) {
            return warning;
        }

        warning = document.createElement("button");
        warning.type = "button";
        warning.className = PACK_SCROLL_WARNING_CLASS;
        warning.hidden = true;
        warning.setAttribute("aria-label", "Na liście są kolejne produkty. Przewiń w dół.");
        warning.title = "Kliknij, aby przewinąć listę produktów w dół";

        const title = document.createElement("span");
        title.className = "gm-more-products-warning-title";
        title.textContent = "WIĘCEJ PRODUKTÓW PONIŻEJ";

        const count = document.createElement("span");
        count.className = "gm-more-products-warning-count";
        count.textContent = "Przewiń listę w dół";

        const arrow = document.createElement("span");
        arrow.className = "gm-more-products-warning-arrow";
        arrow.setAttribute("aria-hidden", "true");
        arrow.textContent = "↓";

        warning.append(title, count, arrow);
        warning.addEventListener("click", () => {
            const currentScroller = getPackagingItemsScroller();
            if (!currentScroller) {
                return;
            }

            currentScroller.scrollBy({
                top: Math.max(260, Math.round(currentScroller.clientHeight * 0.72)),
                behavior: "smooth"
            });
        });

        host.appendChild(warning);
        return warning;
    }

    function clearPackagingScrollWarnings() {
        document.querySelectorAll(`.${PACK_SCROLL_HOST_CLASS}`).forEach((host) => {
            host.classList.remove(PACK_SCROLL_HOST_CLASS);
        });

        document.querySelectorAll(`.${PACK_SCROLL_WARNING_CLASS}`).forEach((warning) => {
            warning.hidden = true;
        });
    }

    function updatePackagingScrollWarning() {
        const scroller = getPackagingItemsScroller();
        const host = scroller?.closest(PACK_ITEMS_CONTAINER_SELECTOR);

        if (!scroller || !host || scroller.clientHeight <= 0) {
            clearPackagingScrollWarnings();
            return;
        }

        const hasOverflow =
            scroller.scrollHeight > scroller.clientHeight + SCROLL_BOTTOM_THRESHOLD_PX;
        const isAtBottom =
            scroller.scrollTop + scroller.clientHeight >=
            scroller.scrollHeight - SCROLL_BOTTOM_THRESHOLD_PX;
        const shouldWarn = hasOverflow && !isAtBottom;

        host.classList.toggle(PACK_SCROLL_HOST_CLASS, shouldWarn);

        const warning = ensureScrollWarningElement(host);
        warning.hidden = !shouldWarn;

        if (!shouldWarn) {
            return;
        }

        const hiddenRows = getHiddenProductRowsCount(scroller);
        const countElement = warning.querySelector(
            ".gm-more-products-warning-count"
        );
        const countText = hiddenRows > 0
            ? `Ukrytych pozycji niżej: ${hiddenRows} — przewiń`
            : "Przewiń listę w dół";

        if (countElement && countElement.textContent !== countText) {
            countElement.textContent = countText;
        }
    }

    function schedulePackagingScrollCheck() {
        if (scrollCheckScheduled) {
            return;
        }

        scrollCheckScheduled = true;
        window.requestAnimationFrame(() => {
            scrollCheckScheduled = false;
            updatePackagingScrollWarning();
        });
    }

    function ensurePackagingScrollTracking() {
        const currentScroller = getPackagingItemsScroller();

        if (currentScroller === observedItemsScroller) {
            return;
        }

        observedItemsScroller?.removeEventListener(
            "scroll",
            schedulePackagingScrollCheck
        );
        itemsResizeObserver?.disconnect();
        itemsResizeObserver = null;
        observedItemsScroller = currentScroller;

        if (!currentScroller) {
            clearPackagingScrollWarnings();
            return;
        }

        currentScroller.addEventListener(
            "scroll",
            schedulePackagingScrollCheck,
            { passive: true }
        );

        if (typeof ResizeObserver === "function") {
            itemsResizeObserver = new ResizeObserver(
                schedulePackagingScrollCheck
            );
            itemsResizeObserver.observe(currentScroller);
            const host = currentScroller.closest(PACK_ITEMS_CONTAINER_SELECTOR);
            if (host) {
                itemsResizeObserver.observe(host);
            }
        }

        schedulePackagingScrollCheck();
    }

    function schedulePackagingScan() {
        if (packScanScheduled) {
            return;
        }

        packScanScheduled = true;
        window.requestAnimationFrame(() => {
            packScanScheduled = false;
            enhancePackagingQuantities();
            ensurePackagingScrollTracking();
            updatePackagingScrollWarning();
        });
    }

    function getOrderSignature() {
        const modal = document.getElementById(PACK_MODAL_ID);
        if (!modal) {
            return "modal-closed";
        }

        const saleId = normalizeText(
            modal.querySelector("#pick_pack_sale_id")?.textContent
        );
        const sessionId = modal.querySelector("#hf_pick_pack_session_id")?.value || "";

        const rows = Array.from(modal.querySelectorAll(PACK_ROW_SELECTOR)).map((row) => {
            const rowKey =
                row.querySelector(".hf_pick_pack_row_key")?.value ||
                row.id ||
                "no-row-key";
            const quantity = normalizeText(
                row.querySelector(".cell_container_product_quantity")?.textContent
            );
            const productName = normalizeText(
                row.querySelector(".cell_container_product_name")?.textContent
            );

            return `${rowKey}:${quantity}:${productName}`;
        });

        return `${saleId}|${sessionId}|${rows.length}|${rows.join("||")}`;
    }

    function handlePossibleOrderChange() {
        const currentSignature = getOrderSignature();
        if (currentSignature === lastOrderSignature) {
            return false;
        }

        lastOrderSignature = currentSignature;
        schedulePackagingScan();

        // Dane zamówienia bywają uzupełniane kilkoma kolejnymi odpowiedziami AJAX.
        window.setTimeout(schedulePackagingScan, 100);
        window.setTimeout(schedulePackagingScan, 500);
        return true;
    }

    function ensurePackagingObserver() {
        const currentPackModal = document.getElementById(PACK_MODAL_ID);

        if (currentPackModal === observedPackModal) {
            return;
        }

        packObserver?.disconnect();
        packObserver = null;
        observedPackModal = currentPackModal;
        lastOrderSignature = "";

        if (!currentPackModal) {
            return;
        }

        // Obserwujemy cały modal, a nie tylko listę produktów. Dzięki temu wykrywamy
        // także zmianę ID zamówienia w nagłówku oraz podmianę zawartości przez AJAX.
        packObserver = new MutationObserver(() => {
            handlePossibleOrderChange();
            schedulePackagingScan();
            schedulePackagingScrollCheck();
        });

        packObserver.observe(currentPackModal, {
            childList: true,
            subtree: true,
            characterData: true
        });

        handlePossibleOrderChange();
        schedulePackagingScan();
        ensurePackagingScrollTracking();
        schedulePackagingScrollCheck();
    }

    function enhanceOrderListQuantities() {
        document.querySelectorAll(".item-xs.item-transparent, .item-xs.product-amount").forEach((element) => {
            const text = normalizeText(element.textContent);
            const quantity = Number.parseInt(text, 10);
            const isWholeNumber = /^\d+$/.test(text);

            element.classList.toggle(
                "product-amount",
                isWholeNumber && quantity > 1
            );
        });
    }

    function highlightClientComments() {
        document.querySelectorAll(".pick_pack_sale_detail_info").forEach((element) => {
            element.classList.toggle(
                "client-comment",
                Boolean(element.querySelector(".fa-comment"))
            );
        });
    }

    function createMarketplaceLink() {
        const marketplaceLink = document.getElementById("sale_info_extra_field_41294");
        const marketplaceButton = document.querySelector(".btn_personal_trigger_43795");

        if (!marketplaceLink || !marketplaceButton) {
            return;
        }

        const url = normalizeText(marketplaceLink.textContent);
        if (!url || !/^https?:\/\//i.test(url)) {
            return;
        }

        marketplaceButton.dataset.gmMarketplaceUrl = url;

        if (marketplaceButton.dataset.gmMarketplaceHandlerAttached === "1") {
            return;
        }

        marketplaceButton.dataset.gmMarketplaceHandlerAttached = "1";
        marketplaceButton.addEventListener("click", (event) => {
            const currentUrl = marketplaceButton.dataset.gmMarketplaceUrl;
            if (!currentUrl) {
                return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
            window.open(currentUrl, "_blank", "noopener,noreferrer");
        }, true);
    }

    function runGeneralEnhancements() {
        enhanceOrderListQuantities();
        highlightClientComments();
        createMarketplaceLink();
        ensurePackagingObserver();
        handlePossibleOrderChange();
        enhancePackagingQuantities();
        ensurePackagingScrollTracking();
        updatePackagingScrollWarning();
    }

    function scheduleGeneralScan() {
        if (generalScanScheduled) {
            return;
        }

        generalScanScheduled = true;
        window.requestAnimationFrame(() => {
            generalScanScheduled = false;
            runGeneralEnhancements();
        });
    }

    function watchdogTick() {
        try {
            ensurePackagingObserver();
            handlePossibleOrderChange();

            if (observedPackModal) {
                schedulePackagingScan();
                ensurePackagingScrollTracking();
                schedulePackagingScrollCheck();
            }
        } catch (error) {
            // Pojedynczy błąd nie może zatrzymać kontroli działającej przez wiele godzin.
            console.error("[GM BaseLinker Improver] Błąd watchdog:", error);
        }
    }

    function start() {
        runGeneralEnhancements();

        // Base.com przełącza moduły i może wymieniać cały modal bez przeładowania strony.
        const pageObserver = new MutationObserver(() => {
            ensurePackagingObserver();
            scheduleGeneralScan();
        });

        pageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Stały watchdog jest zabezpieczeniem na wielogodzinne sesje pakowania.
        // W przeciwieństwie do łańcucha setTimeout jest rejestrowany tylko raz,
        // więc pojedynczy wyjątek nie kończy dalszych kontroli.
        window.setInterval(watchdogTick, WATCHDOG_INTERVAL_MS);

        window.addEventListener("hashchange", scheduleGeneralScan);
        window.addEventListener("popstate", scheduleGeneralScan);
        window.addEventListener("pageshow", scheduleGeneralScan);
        window.addEventListener("resize", schedulePackagingScrollCheck);
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                scheduleGeneralScan();
            }
        });

        document.documentElement.dataset.gmBaselinkerImproverVersion = VERSION;
        console.info(`[GM BaseLinker Improver] Wersja ${VERSION} uruchomiona.`);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
        start();
    }
})();
