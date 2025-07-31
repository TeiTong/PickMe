// ==UserScript==
// @name         PickMe
// @namespace    http://tampermonkey.net/
// @version      3.0.2
// @description  Plugin d'aide à la navigation pour les membres du discord Amazon Vine FR
// @author       Créateur/Codeur principal : MegaMan / Codeur secondaire : Sulff / Testeurs : Louise, JohnnyBGoody, L'avocat du Diable et Popato (+ du code de lelouch_di_britannia, FMaz008 et Thorvarium)
// @match        https://www.amazon.fr/vine/vine-items
// @match        https://www.amazon.fr/vine/vine-items?queue=*
// @match        https://www.amazon.fr/vine/vine-reviews*
// @match        https://www.amazon.fr/vine/orders*
// @match        https://www.amazon.fr/vine/account
// @match        https://www.amazon.fr/vine/resources
// @match        https://www.amazon.fr/gp/buy/thankyou*
// @match        https://www.amazon.fr/checkout*
// @match        https://www.amazon.fr/*
// @match        https://pickme.alwaysdata.net/*
// @match        https://vinepick.me/*
// @exclude      https://www.amazon.fr/vine/vine-items?search=*
// @icon         https://vinepick.me/img/PM-ICO-2.png
// @updateURL    https://raw.githubusercontent.com/teitong/pickme/main/PickMe.user.js
// @downloadURL  https://raw.githubusercontent.com/teitong/pickme/main/PickMe.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_listValues
// @run-at       document-start
// @noframes
// @require      https://raw.githubusercontent.com/teitong/reviewremember/main/ReviewRememberPM.user.js??v=1.9.2
// @require      https://vinepick.me/scripts/jquery-3.7.1.min.js
// @require      https://vinepick.me/scripts/heic2any.min.js
//==/UserScript==

/*
NOTES:
* Votre clé API est lié à votre compte Discord
*/

(function() {
    try {
        'use strict';

        //On exclu les pages que gère RR, on laisse juste pour les pages
        if (!window.location.href.includes('orders') && !window.location.href.includes('vine-reviews'))
        {
            var apiOk = GM_getValue("apiToken", false);
        }

        const baseUrlPickme = "https://vinepick.me";
        const hostnamePickMe = new URL(baseUrlPickme).hostname;

        let defautTab = GM_getValue('defautTab', 'AFA');
        let checkoutRedirect = GM_getValue('checkoutRedirect', true);
        let checkoutButtonUp = GM_getValue('checkoutButtonUp', true);
        let mobileEnabled = GM_getValue("mobileEnabled", false);

        let ordersEnabled = GM_getValue('ordersEnabled', true);

        let headerEnabled = GM_getValue("headerEnabled", false);

        GM_setValue("defautTab", defautTab);
        GM_setValue("checkoutRedirect", checkoutRedirect);
        GM_setValue("checkoutButtonUp", checkoutButtonUp);

        GM_setValue("ordersEnabled", ordersEnabled);

        GM_setValue("mobileEnabled", mobileEnabled);

        GM_setValue("headerEnabled", headerEnabled);

        const lienVine = {
            'RFY': 'https://www.amazon.fr/vine/vine-items?queue=potluck',
            'AFA': 'https://www.amazon.fr/vine/vine-items?queue=last_chance',
            'AI':  'https://www.amazon.fr/vine/vine-items?queue=encore',
            'ALL': 'https://www.amazon.fr/vine/vine-items?queue=all_items',
        };

        //On applique la suppression du header pour toutes les pages concernées par Vine
        const urlVine = window.location.href;

        const isAmazonTargetPage = [
            /^https:\/\/www\.amazon\.fr\/vine\//,
            /^https:\/\/www\.amazon\.fr\/gp\/buy\/thankyou/,
            /^https:\/\/www\.amazon\.fr\/checkout/,
            /^https:\/\/www\.amazon\.fr\/review\/create-review/,
            /^https:\/\/www\.amazon\.fr\/review\/edit-review/
        ].some(pattern => pattern.test(urlVine));

        if (isAmazonTargetPage) {
            //Cacher le header ou non
            if (headerEnabled) {
                //Suppression header
                var styleHeader = document.createElement('style');

                styleHeader.textContent = `
            body {
              padding-right: 0px !important;
            }

            #navbar-main, #nav-main, #skiplink {
              display: none;
            }

            .amzn-ss-wrap {
              display: none !important;
            }
            `
                document.head.appendChild(styleHeader);
            }

        }

        //Page du passage de commande du nouveau checkout
        //Pour tester si le checkout provient bien d'une page vine
        const previousPage = document.referrer;
        const url_checkout = window.location.href;

        //Page de checkout
        function checkOut(currentUrl) {
            const match_checkout = currentUrl.match(/\/checkout\/p\/p-(\d{3}-\d{7}-\d{7})/);
            if (apiOk && previousPage && ordersEnabled && match_checkout && previousPage.includes("vine-items")) {
                //On purge les anciennes commandes
                function purgeOldPurchaseData() {
                    const now = Date.now();
                    const maxAge = 24 * 60 * 60 * 1000; //24 heures en millisecondes
                    const stored = GM_getValue("purchaseData", {});
                    let modified = false;

                    for (const purchaseId in stored) {
                        const entry = stored[purchaseId];
                        if (!entry.timestamp || now - entry.timestamp > maxAge) {
                            delete stored[purchaseId];
                            modified = true;
                        }
                    }

                    if (modified) {
                        GM_setValue("purchaseData", stored);
                    }
                }
                purgeOldPurchaseData();
                const purchaseId = match_checkout[1];
                const asinCheckout = GM_getValue("asinCheckout", null);
                const asinParentCheckout = GM_getValue("asinParentCheckout", null);
                const queueCheckout = GM_getValue("queueCheckout", null);
                let stored = GM_getValue("purchaseData", {});
                const now = Date.now(); //Timestamp
                stored[purchaseId] = {
                    asin: asinCheckout,
                    parent: asinParentCheckout,
                    queue: queueCheckout,
                    timestamp: now
                };
                GM_setValue("purchaseData", stored);
                GM_deleteValue("asinCheckout");
                GM_deleteValue("asinParentCheckout");
                GM_deleteValue("queueCheckout");
            }
        }

        //Pour surveiller la page checkout contenant l'id de commande car c'est une redirection
        const targetPattern = /^https:\/\/www\.amazon\.fr\/checkout\/entry\/buynow\?pipelineType=Chewbacca$/;
        let previousUrl = location.href;

        if (previousPage.includes("vine-items") && targetPattern.test(previousUrl) && ordersEnabled) {
            const interval = setInterval(() => {
                const currentUrl = location.href;

                if (currentUrl !== previousUrl) {
                    clearInterval(interval); //On arrête la surveillance
                    console.log("[PïckMe] Changement d’URL détecté :", currentUrl);
                    checkOut(currentUrl);
                }
            }, 100); //Vérifie toutes les 100 ms
        }

        //Page de commande validée
        if (apiOk && window.location.href.includes("/gp/buy/thankyou/handlers")) {
            if (ordersEnabled) {
                const purchaseId = new URLSearchParams(location.search).get('purchaseId');
                let stored = GM_getValue("purchaseData", {});
                const data = stored[purchaseId];
                if (data) {
                    delete stored[purchaseId];
                    GM_setValue("purchaseData", stored);
                    let data_order = {
                        version: GM_info.script.version,
                        token: apiOk,
                        parent_asin: data.parent,
                        asin: data.asin,
                        queue: data.queue,
                        success: "success"
                    };
                    const formData = new URLSearchParams(data_order);
                    fetch(baseUrlPickme + "/shyrka/order", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formData.toString()
                    });
                }
            }
            function moveVineButton() {
                if (checkoutRedirect) {
                    const bouton = document.querySelector('#widget-continueShoppingEgress a.a-button-text');

                    //Vérifie qu'on l'a trouvé et que le texte contient "Vine"
                    if (bouton && bouton.textContent.includes('Vine')) {
                        const nouvelleURL = lienVine[defautTab];
                        if (nouvelleURL) {
                            bouton.href = nouvelleURL;
                        }
                    }
                }
                if (checkoutButtonUp) {
                    //Récupère le bouton source
                    const sourceButtonContainer = document.querySelector('#widget-continueShoppingEgress');

                    //Vérifie si le bouton contient "Vine"
                    if (!sourceButtonContainer) return;
                    const text = sourceButtonContainer.textContent || '';
                    if (!text.includes('Vine')) return;

                    //Clone le bouton
                    const clone = sourceButtonContainer.cloneNode(true);

                    //Cible la zone de destination
                    const targetContainer = document.querySelector('#widget-accountLevelActions');

                    if (targetContainer && clone) {
                        //Insère le clone juste après le conteneur cible
                        targetContainer.insertAdjacentElement('afterend', clone);
                    }
                }
            }

            //Attendre que le DOM soit prêt
            //Fix iPhone
            if (document.readyState !== 'loading') {
                moveVineButton();
            }
            else {
                document.addEventListener('DOMContentLoaded', function () {
                    moveVineButton();
                });
            }
        }

        //URL Vine
        const urlPattern = /^https:\/\/www\.amazon\.fr\/vine/;

        //Liste des URLs Vine
        const excludedPatterns = [
            'https://www.amazon.fr/vine/vine-items',
            'https://www.amazon.fr/vine/vine-items?queue=*',
            'https://www.amazon.fr/vine/vine-reviews*',
            'https://www.amazon.fr/vine/orders*',
            'https://www.amazon.fr/vine/account',
            'https://www.amazon.fr/vine/resources'
        ];

        //Fonction pour extraire l'ASIN
        function getASINfromURL(url) {
            //Expression régulière pour trouver l'ASIN dans différentes structures d'URL Amazon
            const regex = /\/(dp|gp\/product|product-reviews|gp\/aw\/d)\/([A-Za-z0-9]{10})/i;
            const match = url.match(regex);
            return match ? match[2] : null; //Retourne l'ASIN ou null si non trouvé
        }

        function isAffiliateTagPresent() {
            return window.location.search.indexOf('tag=monsieurconso-21') > -1;
        }

        //Ajout du bouton
        function addButton(asin) {
            if (!document.querySelector('#pickme-button')) {
                var priceContainer = document.querySelector('.basisPriceLegalMessage');
                if (priceContainer) {
                    const affiliateButton = createButton(asin);
                    //Insérez le nouveau bouton dans le DOM juste après le conteneur de prix
                    priceContainer.parentNode.insertBefore(affiliateButton, priceContainer.nextSibling);
                } else {
                    //priceContainer = document.querySelectorAll('snsPriceRow');
                    //Selecteur du prix desktop ou mobile
                    var priceContainerVar = document.getElementById('corePrice_desktop');
                    if (!priceContainerVar) {
                        priceContainerVar = document.getElementById('corePrice_mobile_feature_div');
                        //Gestion pour les livres
                        if (!priceContainerVar) {
                            priceContainer = document.getElementById("bookDescription_feature_div");
                            if (priceContainer) {
                                const affiliateButton = createButton(asin);
                                priceContainer.parentNode.insertBefore(affiliateButton, priceContainer);
                            }
                        }
                    } else {
                        priceContainer = priceContainerVar.querySelector('.a-span12');
                        if (priceContainer) {
                            const affiliateButton = createButton(asin);
                            //priceContainer.parentNode.insertAdjacentElement('afterend', affiliateButton);
                            priceContainer.parentNode.insertAdjacentElement('beforeend', affiliateButton);
                        }
                    }
                }
            }
        }

        function submitPost(asin) {
            var form = document.createElement('form');
            form.method = 'POST';
            form.action = baseUrlPickme + '/monsieurconso/top.php';
            form.target = '_blank';

            var asinField = document.createElement('input');
            asinField.type = 'hidden';
            asinField.name = 'asin';
            asinField.value = asin;

            form.appendChild(asinField);

            document.body.appendChild(form);
            form.submit();
        }

        function createButton(asin) {
            var container = document.createElement('div'); //Créer un conteneur pour le bouton et le texte d'explication
            container.style.display = 'inline-flex';
            container.style.alignItems = 'center';

            var affiliateButton = document.createElement('a');
            affiliateButton.className = 'a-button a-button-primary a-button-small';
            affiliateButton.id = 'pickme-button';
            affiliateButton.style.marginTop = '5px'; //Pour ajouter un peu d'espace au-dessus du bouton
            affiliateButton.style.marginBottom = '5px';
            affiliateButton.style.color = 'white'; //Changez la couleur du texte en noir
            //affiliateButton.style.maxWidth = '200px';
            affiliateButton.style.height = '29px';
            affiliateButton.style.lineHeight = '29px';
            affiliateButton.style.borderRadius = '20px';
            affiliateButton.style.whiteSpace = 'nowrap';
            affiliateButton.style.padding = '0 40px';
            affiliateButton.style.backgroundColor = '#CC0033';
            affiliateButton.style.border = '1px solid white';
            affiliateButton.style.display = 'inline-block';

            if (isAffiliateTagPresent()) {
                affiliateButton.innerText = 'Lien PickMe actif';
                affiliateButton.style.backgroundColor = 'green'; //Changez la couleur de fond en vert
                affiliateButton.style.color = 'white';
                affiliateButton.style.pointerEvents = 'none'; //Empêchez tout événement de clic
                affiliateButton.style.cursor = 'default';
                affiliateButton.style.border = '1px solid black';
                container.appendChild(affiliateButton); //Ajouter le bouton et le texte d'explication au conteneur
            } else {
                /*affiliateButton.onclick = function() {
                submitPost(asin);
            };*/
                affiliateButton.href = baseUrlPickme + `/monsieurconso/product.php?asin=${asin}`;
                affiliateButton.innerText = 'Acheter via PickMe';
                affiliateButton.target = '_blank';
                var infoText = document.createElement('span'); //Créer l'élément de texte d'explication
                infoText.innerHTML = '<b>A quoi sert ce bouton ?</b>';
                infoText.style.marginLeft = '5px';
                infoText.style.color = '#CC0033';
                infoText.style.cursor = 'pointer';
                infoText.style.fontSize = '14px';
                infoText.onclick = function() {
                    alert("Ce bouton permet de soutenir le discord Amazon Vine FR. Il n'y a strictement aucune conséquence sur votre achat, mise à part d'aider à maintenir les services du discord et de PickMe.\n\nComment faire ?\n\nIl suffit de cliquer sur 'Acheter via PickMe' et dans la nouvelle fenêtre de cliquer sur 'Acheter sur Amazon'. Normalement le bouton sera devenu vert, il suffit alors d'ajouter le produit au panier (uniquement quand le bouton est vert) et c'est tout !\nMerci beaucoup !");
                };
                container.appendChild(affiliateButton);
                container.appendChild(infoText);
            }
            affiliateButton.style.fontSize = '14px';
            return container; //Retourner le conteneur au lieu du bouton seul
        }

        //Détermine si on ajoute l'onglet Notifications
        var pageProduit = false;
        var asinProduct = getASINfromURL(window.location.href);
        function asinReady() {
            if (asinProduct) {
                pageProduit = true;
                addButton(asinProduct);
                const observer = new MutationObserver(mutations => {
                    mutations.forEach(mutation => {
                        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                            asinProduct = getASINfromURL(window.location.href);
                            addButton(asinProduct);
                        }
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
                return;
            }
        }

        //Fix iPhone
        if (document.readyState !== 'loading') {
            asinReady();
        }
        else {
            document.addEventListener('DOMContentLoaded', function () {
                asinReady();
            });
        }

        //Notif
        //On initialise les variables utiles pour cette partie du script
        let notifEnabled = GM_getValue("notifEnabled", false);
        let onMobile = GM_getValue("onMobile", false);
        let shortcutNotif = GM_getValue("shortcutNotif", false);
        let callUrl = GM_getValue("callUrl", "");
        var apiKey = GM_getValue("apiToken", false);
        let notifUp = GM_getValue('notifUp', true);
        let notifRecos = GM_getValue('notifRecos', false);
        let notifRFY = GM_getValue('notifRFY', false);
        let notifPartageAFA = GM_getValue('notifPartageAFA', true);
        let notifPartageAI = GM_getValue('notifPartageAI', false);
        let notifPartageALL = GM_getValue('notifPartageALL', true);
        let notifAutres = GM_getValue('notifAutres', true);
        let notifSound = GM_getValue('notifSound', true);
        let notifFav = GM_getValue('notifFav', false);
        let favWords = GM_getValue('favWords', '');
        let hideWords = GM_getValue('hideWords', '');
        let filterOption = GM_getValue('filterOption', 'notifFavOnly');
        let hideEnabled = GM_getValue("hideEnabled", true);
        let savedTheme = GM_getValue('selectedTheme', 'default');

        let notifUrl = GM_getValue('notifUrl', baseUrlPickme + '/sw/notif3.mp3');

        let favUrlOn = GM_getValue('favUrlOn', baseUrlPickme + "/img/coeurrouge2.png");
        let favUrlOff = GM_getValue('favUrlOff', baseUrlPickme + "/img/coeurgris2.png");
        let hideUrlOn = GM_getValue('hideUrlOn', baseUrlPickme + "/img/eye.png");
        let hideUrlOff = GM_getValue('hideUrlOff', baseUrlPickme + "/img/eyehidden.png");

        let NSFWEnabled = GM_getValue('NSFWEnabled', false);
        let blurLevel = GM_getValue('blurLevel', '15');
        let NSFWHide = GM_getValue('NSFWHide', false);

        let notepadEnabled = GM_getValue('notepadEnabled', true);


        let notifVolumeEnabled = GM_getValue('notifVolumeEnabled', false);
        let notifVolume = GM_getValue('notifVolume', "1");

        GM_setValue("notifEnabled", notifEnabled);
        GM_setValue("onMobile", onMobile);
        GM_setValue("shortcutNotif", shortcutNotif);
        GM_setValue("callUrl", callUrl);
        GM_setValue("notifUp", notifUp);
        GM_setValue("notifRecos", notifRecos);
        GM_setValue("notifRFY", notifRFY);
        GM_setValue("notifPartageAFA", notifPartageAFA);
        GM_setValue("notifPartageAI", notifPartageAI);
        GM_setValue("notifPartageALL", notifPartageALL);
        GM_setValue("notifAutres", notifAutres);
        GM_setValue("notifSound", notifSound);
        GM_setValue("notifFav", notifFav);
        GM_setValue("favWords", favWords);
        GM_setValue("hideWords", hideWords);
        GM_setValue("filterOption", filterOption);
        GM_setValue("hideEnabled", hideEnabled);
        GM_setValue("selectedTheme", savedTheme);

        GM_setValue("notifUrl", notifUrl);

        GM_setValue("favUrlOn", favUrlOn);
        GM_setValue("favUrlOff", favUrlOff);
        GM_setValue("hideUrlOn", hideUrlOn);
        GM_setValue("hideUrlOff", hideUrlOff);

        GM_setValue("NSFWEnabled", NSFWEnabled);
        GM_setValue("blurLevel", blurLevel);
        GM_setValue("NSFWHide", NSFWHide);

        GM_setValue("notepadEnabled", notepadEnabled);

        GM_setValue("notifVolumeEnabled", notifVolumeEnabled);
        GM_setValue("notifVolume", notifVolume);

        //Convertir la date SQL en date lisible européenne
        function convertToEuropeanDate(mysqlDate) {
            if (!mysqlDate) return '';

            const date = new Date(mysqlDate);
            const day = ('0' + date.getDate()).slice(-2);
            const month = ('0' + (date.getMonth() + 1)).slice(-2); //Les mois commencent à 0 en JavaScript
            const year = date.getFullYear();
            const hours = ('0' + date.getHours()).slice(-2);
            const minutes = ('0' + date.getMinutes()).slice(-2);
            const seconds = ('0' + date.getSeconds()).slice(-2);

            return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
        }

        //Récupérer les infos d'un produit dans l'API
        function infoProduct(asin) {
            const formData = new URLSearchParams({
                version: GM_info.script.version,
                token: apiKey,
                asin: asin,
            });

            return fetch(baseUrlPickme + "/shyrka/infoasin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formData.toString()
            })
                .then(response => {
                if (response.status === 200) {
                    return response.json().then(data => {
                        const { date_last, title, linkText, linkUrl, main_image } = data;
                        const date_last_eu = convertToEuropeanDate(date_last);
                        return { date_last_eu, title, linkText, linkUrl, main_image };
                    }).catch(error => {
                        console.error("Erreur lors de l'analyse de la réponse JSON:", error);
                        throw new Error("Erreur lors de l'analyse de la réponse JSON");
                    });
                } else if (response.status === 201) {
                    return response.text();
                } else {
                    console.error("Erreur HTTP:", response.status, response.statusText);
                    throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
                }
            })
                .catch(error => {
                console.error("Erreur de requête:", error);
                throw error;
            });
        }

        //Fonction pour demander la permission et afficher la notification
        function requestNotification(title, text, icon, queue = null, page = null, pn = null, cn = null) {
            if (!("Notification" in window)) {
                console.log("[PïckMe] Ce navigateur ne supporte pas les notifications de bureau.");
                return;
            }
            if (Notification.permission === "granted") {
                if (onMobile) {
                    navigator.serviceWorker.getRegistration().then(function(reg) {
                        if (reg) {
                            reg.showNotification(title, {
                                body: text || "",
                                icon: icon,
                                data: { queue: queue, page : page, cn : cn, pn : pn }
                            });
                        }
                    });
                } else {
                    showNotification(title, text, icon, queue, page, pn, cn);
                }
                soundNotif();
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        if (onMobile) {
                            navigator.serviceWorker.getRegistration().then(function(reg) {
                                if (reg) {
                                    reg.showNotification(title, {
                                        body: text || "",
                                        icon: icon,
                                        data: { queue: queue, page : page, cn : cn, pn : pn }
                                    });
                                }
                            });
                        } else {
                            showNotification(title, text, icon, queue, page, pn, cn);
                        }
                        soundNotif();
                    }
                });
            }
        }

        function playSound(url) {
            const audio = new Audio(url);

            if (notifVolumeEnabled) {
                const volume = Math.max(0, Math.min(1, notifVolume));
                audio.volume = volume;
            }

            audio.play().catch((err) => {
                console.warn('Erreur lors de la lecture du son :', err);
            });
        }

        function soundNotif() {
            if (notifSound) {
                var sound = new Audio(notifUrl);
                if (notifVolumeEnabled) {
                    const volume = Math.max(0, Math.min(1, notifVolume));
                    sound.volume = volume;
                }
                sound.play().catch((err) => {
                    console.warn('Erreur lors de la lecture du son :', err);
                });
            }
        }

        //Fonction pour afficher la notification sur PC
        function showNotification(title, text, icon, queue = null, page = null, pn = null, cn = null) {
            var notification = new Notification(title, {
                body: text || "",
                icon: icon
            });
            notification.onclick = function () {
                window.focus(); //Focus le navigateur quand on clique sur la notification
                var baseUrl = "https://www.amazon.fr/vine/vine-items";
                var url = baseUrl; //Initialisation de l'URL de base
                //Déterminer l'URL en fonction de la queue
                if (queue === "0") {
                    url = baseUrl + "?queue=last_chance";
                    if (page) url += "&page=" + encodeURIComponent(page);
                } else if (queue === "1") {
                    url = baseUrl + "?queue=encore";
                    if (pn) url += "&pn=" + encodeURIComponent(pn);
                    if (cn) url += "&cn=" + encodeURIComponent(cn);
                    if (page) url += "&page=" + encodeURIComponent(page);
                } else if (queue === "2") {
                    url = baseUrl + "?queue=potluck";
                } else if (queue === "3") {
                    url = baseUrl + "?queue=all_items";
                    if (pn) url += "&pn=" + encodeURIComponent(pn);
                    if (cn) url += "&cn=" + encodeURIComponent(cn);
                    if (page) url += "&page=" + encodeURIComponent(page);
                } else {
                    url = baseUrl + "?queue=encore" + (queue ? "&pn=" + queue : "") + (page ? "&cn=&page=" + page : "");
                }
                //Ouvrir l'URL dans un nouvel onglet
                window.open(url, '_blank');
            };
        }

        //Ecoute des messages entrants
        if (notifEnabled && apiKey) {
            var lastNotifId = null;
            if (notifFav) {
                var titleContentLower;
                if (filterOption == "notifFavOnly") {
                    var favWordsTrimNotif = favWords.trim();
                    var favArrayNotif = favWordsTrimNotif.length > 0
                    ? favWordsTrimNotif.split(',').map(pattern => {
                        pattern = pattern.trim();
                        if (pattern.length > 0) {
                            try {
                                return new RegExp(pattern, 'i');
                            } catch (e) {
                                console.error('Expression regex invalide :', pattern, e);
                                return null;
                            }
                        } else {
                            return null;
                        }
                    }).filter(regex => regex != null)
                    : [];

                } else if (filterOption == "notifExcludeHidden") {
                    var hiddenWordsTrimNotif = hideWords.trim();
                    var hiddenArrayNotif = hiddenWordsTrimNotif.length > 0
                    ? hiddenWordsTrimNotif.split(',').map(pattern => {
                        pattern = pattern.trim();
                        if (pattern.length > 0) {
                            try {
                                return new RegExp(pattern, 'i');
                            } catch (e) {
                                console.error('Expression regex invalide :', pattern, e);
                                return null;
                            }
                        } else {
                            return null;
                        }
                    }).filter(regex => regex != null)
                    : [];
                }
            }
            //Écouter les messages immédiatement
            window.addEventListener('message', function(event) {
                //console.log("PickMe :", event);
                lastNotifId = GM_getValue('lastNotifId', null);
                if (event.data.type === 'NEW_MESSAGE' && (event.origin == "https://pickme.alwaysdata.net" || event.origin == baseUrlPickme) && event.data.id != lastNotifId) {
                    lastNotifId = event.data.id;
                    GM_setValue('lastNotifId', lastNotifId);
                    if ((event.data.info.toUpperCase() === "UP" && notifUp) ||
                        (event.data.info.toUpperCase() === "RECO" && notifRecos) ||
                        (event.data.info.toUpperCase() === "PRODUCT_AFA" && notifPartageAFA) ||
                        (event.data.info.toUpperCase() === "PRODUCT_AI" && notifPartageAI) ||
                        (event.data.info.toUpperCase() === "PRODUCT_ALL" && notifPartageALL) ||
                        (event.data.info.toUpperCase() === "PRODUCT_RFY" && notifRFY) ||
                        (event.data.info.toUpperCase() === "AUTRES" && notifAutres)) {
                        if (notifFav && (event.data.info.toUpperCase() === "PRODUCT_AI" || event.data.info.toUpperCase() === "PRODUCT_ALL")) {
                            titleContentLower = event.data.description.toLowerCase().trim().replace(/\s+/g, '');
                            if (filterOption == "notifFavOnly") {
                                if (favArrayNotif.length > 0 && favArrayNotif.some(regex => regex.test(titleContentLower))) {
                                    requestNotification(event.data.title, event.data.description, event.data.imageUrl, event.data.queue, event.data.page, event.data.pn, event.data.cn);
                                }
                            } else if (filterOption == "notifExcludeHidden") {
                                if (hiddenArrayNotif.length > 0 && !hiddenArrayNotif.some(regex => regex.test(titleContentLower))) {
                                    requestNotification(event.data.title, event.data.description, event.data.imageUrl, event.data.queue, event.data.page, event.data.pn, event.data.cn);
                                }
                            }
                        } else {
                            requestNotification(event.data.title, event.data.description, event.data.imageUrl, event.data.queue, event.data.page, event.data.pn, event.data.cn);
                        }
                    }
                }
            });

            function addNotifTab() {
                if (window.location.hostname !== "pickme.alwaysdata.net" || window.location.hostname !== hostnamePickMe) {
                    //Initialisation de l'iframe seulement si on est sur le bon domaine
                    var iframe = document.createElement('iframe');
                    iframe.style.display = 'none'; //Rendre l'iframe invisible
                    iframe.src = baseUrlPickme + "/sw/websocket.php?key=" + encodeURIComponent(apiKey);
                    document.body.appendChild(iframe);
                } else {
                    document.cookie = "pm_apiKey=" + encodeURIComponent(apiKey) + "; path=/; secure";
                }
                if (shortcutNotif && !pageProduit && window.location.href.indexOf("vine") !== -1) {
                    //Sélectionner le conteneur des onglets
                    var tabsContainer = document.querySelector('.a-tabs');

                    //Créer le nouvel onglet pour Notifications
                    var newTab1 = document.createElement('li');
                    newTab1.className = 'a-tab-heading';
                    newTab1.role = 'presentation';

                    //Créer le lien à ajouter dans le nouvel onglet Notifications
                    var link1 = document.createElement('a');
                    link1.href = baseUrlPickme + "/sw/notification.php?key=" + encodeURIComponent(apiKey);
                    link1.role = 'tab';
                    link1.setAttribute('aria-selected', 'false');
                    link1.tabIndex = -1;
                    link1.textContent = 'Notifications';
                    link1.target = '_blank';
                    link1.style.color = '#f8a103';
                    link1.style.backgroundColor = 'transparent';
                    link1.style.border = 'none';

                    //Ajouter le lien au nouvel onglet Notifications
                    newTab1.appendChild(link1);

                    //Ajouter les nouveaux onglets au conteneur des onglets
                    if (tabsContainer) {
                        tabsContainer.appendChild(newTab1);
                    }
                }
            }

            //Fix iPhone
            if (document.readyState !== 'loading') {
                addNotifTab();
            }
            else {
                document.addEventListener('DOMContentLoaded', function () {
                    addNotifTab()
                });
            }
        }

        //Fonction pour charger le fichier CSS
        function loadCSS(url) {
            var link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;
            document.getElementsByTagName('head')[0].appendChild(link);
        }

        //URL des CSS
        var baseURLCSS = baseUrlPickme + "/";

        //Gestion des favoris sur PickMe Web
        if ((window.location.hostname === "pickme.alwaysdata.net" || window.location.hostname === hostnamePickMe) && /^\/[^\/]+\.php$/.test(window.location.pathname)) {
            if (savedTheme == "dark") {
                loadCSS(baseURLCSS + "style-dark.css");
            }
            document.addEventListener('click', function(event) {
                //Vérifier si l'élément cliqué a la classe 'favori-icon'
                if (event.target.classList.contains('favori-icon')) {
                    //let dataId = event.target.getAttribute('data-id');
                    let dataFavori = event.target.getAttribute('data-favori');
                    let dataAsin = event.target.getAttribute('data-asin');
                    if (dataFavori == 1) {
                        GM_setValue(dataAsin +'_f', '1');
                    } else if (dataFavori == 0) {
                        GM_deleteValue(dataAsin + '_f');
                    }
                }
            });
            //Auto log si on a pickme installé
            //On check s'il y a la zone de saisie de la clé API
            const apiKeyInput = document.querySelector('input[type="text"].form-control#api_key[name="api_key"][required]');

            //Vérifie si le message d'erreur n'est PAS présent
            const errorAlert = document.querySelector('div.alert.alert-danger');
            //Récupère le dernier moment de redirection enregistré pour éviter de le faire en boucle
            const lastRedirect = localStorage.getItem('lastRedirectTime');
            const now = Date.now();
            //On le fait seulement s'il y a le champ de saisie, mais sans le message d'erreur et si pas fait depuis plus de 1 minute
            if (apiKeyInput && !errorAlert && (!lastRedirect || now - lastRedirect > 60000)) {
                if (apiKey) {
                    localStorage.setItem('lastRedirectTime', now);
                    const redirectUrl = baseUrlPickme + "/search.php?key=" + encodeURIComponent(apiKey);
                    window.location.href = redirectUrl;
                }
            }
        }

        //Popup pour le bloc-notes
        function setNote() {
            //Vérifie si une popup existe déjà et la supprime si c'est le cas
            const existingPopup = document.getElementById('notePopup');
            if (existingPopup) {
                existingPopup.remove();
            }

            //Crée la fenêtre popup
            const popup = document.createElement('div');
            popup.id = "notePopup";
            popup.style.cssText = `
        position: fixed;
        z-index: 10002;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background-color: white;
        border: 1px solid #ccc;
        box-shadow: 0px 0px 10px #ccc;
    `;
            popup.innerHTML = `
        <h2 id="configPopupHeader" style="cursor: grab;">Bloc-notes<span id="closeNotePopup" style="float: right; cursor: pointer;">✖</span></h2>
        <textarea id="noteTextArea" style="width: 100%; height: 300px;"></textarea>
        <div class="button-container final-buttons">
            <button class="full-width" id="saveNote">Enregistrer</button>
            <button class="full-width" id="closeNote">Fermer</button>
        </div>
    `;

            document.body.appendChild(popup);

            //Ajoute des écouteurs d'événement pour les boutons
            document.getElementById('saveNote').addEventListener('click', function() {
                const noteContent = document.getElementById('noteTextArea').value;
                //Stocker le contenu de la note avec GM_setValue
                GM_setValue("noteContent", noteContent);
                popup.remove();
            });

            document.getElementById('closeNote').addEventListener('click', function() {
                popup.remove();
            });

            document.getElementById('closeNotePopup').addEventListener('click', function() {
                popup.remove();
            });

            //Charger la note existante si elle est stockée avec GM_getValue
            const savedNoteContent = GM_getValue("noteContent", "");
            if (savedNoteContent) {
                document.getElementById('noteTextArea').value = savedNoteContent;
            }

            //Ajoute la fonctionnalité de déplacement
            const header = document.getElementById('configPopupHeader');
            let isDragging = false;
            let offsetX, offsetY;

            header.addEventListener('mousedown', function(e) {
                isDragging = true;
                header.style.cursor = 'grabbing';
                offsetX = e.clientX - popup.getBoundingClientRect().left;
                offsetY = e.clientY - popup.getBoundingClientRect().top;
                document.addEventListener('mousemove', movePopup);
                document.addEventListener('mouseup', stopDragging);
            });

            function movePopup(e) {
                if (isDragging) {
                    popup.style.left = `${e.clientX - offsetX}px`;
                    popup.style.top = `${e.clientY - offsetY}px`;
                    popup.style.transform = `translate(0, 0)`;
                }
            }

            function stopDragging() {
                isDragging = false;
                header.style.cursor = 'grab';
                document.removeEventListener('mousemove', movePopup);
                document.removeEventListener('mouseup', stopDragging);
            }
        }

        function getProductAsin(produit) {
            return produit.getAttribute("data-asin") ||
                (
                produit.querySelector(".vvp-details-btn input") ||
                produit.querySelector(".vvp-details-btn-mobile input")
            )?.getAttribute("data-asin");
        }

        function getStringDetailsBtnSelector() {
            const isMobile = document.querySelector('.vvp-details-btn-mobile') !== null;
            return isMobile ? 'vvp-details-btn-mobile' : 'vvp-details-btn';
        }

        //Pour savoir si on a la version mobile du site ou non
        function isMobile() {
            return document.documentElement.classList.contains('a-mobile');
        }

        function ensureMobileTabsContainer() {
            var container = document.querySelector(".a-tabs");
            if (!container) {
                var parent = document.querySelector("#a-page > div.a-container.vvp-body > div.a-tab-container.vvp-tab-set-container");
                if (parent) {
                    container = document.createElement("ul");
                    container.className = "a-tabs";
                    container.id = "pickme-mobile-tabs";
                    parent.insertBefore(container, parent.firstChild);
                }
            }
            return container;
        }

        function addHomeTab() {
            if (isMobile() && (window.location.href.indexOf("vine-items") !== -1 || window.location.href.indexOf("vine-reviews") !== -1 || window.location.href.indexOf("orders") !== -1 || window.location.href.indexOf("account") !== -1)) {
                const tabsContainer = document.querySelector(".a-tabs") || ensureMobileTabsContainer();
                if (!tabsContainer) return;

                const queueLink = lienVine[defautTab] || lienVine["AFA"];

                //Onglet Articles
                const homeTab = document.createElement('li');
                homeTab.className = 'a-tab-heading';
                homeTab.innerHTML = `<a href="${queueLink}" id="accueilTab" role="tab" aria-selected="false" tabindex="-1">Articles</a>`;
                tabsContainer.insertBefore(homeTab, tabsContainer.firstChild);

                const defaultLink = document.querySelector('#vvp-vine-items-tab a');
                document.getElementById('accueilTab').addEventListener('click', function(e) {
                    document.querySelectorAll('.a-tab-heading').forEach(tab => {
                        tab.classList.remove('a-active');
                    });
                    this.parentElement.classList.add('a-tab-heading', 'a-active');
                    this.setAttribute('aria-selected', 'true');

                    //Réafficher les contenus des onglets Amazon cachés lors du passage sur "Favoris"
                    document.querySelectorAll('.a-box-tab').forEach(box => {
                        box.style.display = '';
                    });

                    const favContainer = document.getElementById('favorisContainer');
                    if (favContainer) {
                        favContainer.style.display = 'none';
                    }
                    if (defaultLink) {
                        e.preventDefault();
                        defaultLink.click();
                    }
                });
            }
        }

        //Affichage de l'onglet "Favoris"
        function addTab() {
            if (!pageProduit && window.location.href.indexOf("vine") !== -1 && apiKey) {
                //Sélectionner le conteneur des onglets
                var tabsContainer = document.querySelector(".a-tabs");
                if (!tabsContainer) {
                    tabsContainer = ensureMobileTabsContainer();
                    addHomeTab();
                }
                //Créer le nouvel onglet pour Pickme Web
                var newTab2 = document.createElement('li');
                newTab2.className = 'a-tab-heading';
                newTab2.role = 'presentation';

                //Créer le lien à ajouter dans le nouvel onglet Pickme Web
                var link2 = document.createElement('a');
                link2.href = baseUrlPickme + "/account.php?key=" + encodeURIComponent(apiKey);
                link2.role = 'tab';
                link2.setAttribute('aria-selected', 'false');
                link2.tabIndex = -1;
                link2.textContent = 'PickMe Web';
                link2.target = '_blank';
                link2.style.color = '#f8a103';
                link2.style.backgroundColor = 'transparent';
                link2.style.border = 'none';

                //Ajouter le lien au nouvel onglet Pickme Web
                newTab2.appendChild(link2);

                //Créer le nouvel onglet pour Bloc-notes
                var newTab3 = document.createElement('li');
                newTab3.className = 'a-tab-heading';
                newTab3.role = 'presentation';

                if (notepadEnabled) {
                    //Créer le lien à ajouter dans le nouvel onglet Bloc notes
                    var link3 = document.createElement('a');
                    link3.href = "#"; //Garder un lien neutre
                    link3.role = 'tab';
                    link3.setAttribute('aria-selected', 'false');
                    link3.tabIndex = -1;
                    link3.textContent = 'Bloc-notes';
                    link3.target = '_blank';
                    link3.style.color = '#f8a103';
                    link3.style.backgroundColor = 'transparent';
                    link3.style.border = 'none';

                    //Créer l'image à ajouter devant le texte "Bloc-notes"
                    /*var image = document.createElement('img');
                image.src = baseUrlPickme + '/img/loupe.png';
                image.alt = 'Loupe';
                image.style.cursor = 'pointer';
                image.style.marginRight = '5px';
                image.style.width = '14px';
                image.style.height = '14px';*/

                    //Ajouter l'événement onclick pour appeler la fonction setNote pour le lien
                    link3.onclick = function(event) {
                        event.preventDefault(); //Empêche le lien de suivre l'URL
                        setNote();
                    };


                    //Ajouter l'événement onclick pour afficher la note stockée lors du clic sur l'image
                    /*image.onclick = function(event) {
                    event.preventDefault(); //Empêche toute action par défaut
                    event.stopPropagation(); //Empêche la propagation du clic au lien
                    const noteContent = GM_getValue("noteContent", "");
                    alert(noteContent);
                };

                //Ajouter l'image et le texte "Bloc-notes" au lien
                link3.prepend(image);*/

                    //Ajouter le lien dans le nouvel onglet
                    newTab3.appendChild(link3);
                }

                //Ajouter les nouveaux onglets au conteneur des onglets
                if (tabsContainer) {
                    tabsContainer.appendChild(newTab3);
                    //tabsContainer.appendChild(newTab1);
                    tabsContainer.appendChild(newTab2);
                }
            }
        }

        if (asinProduct) {
            //Solution alternative pour le bouton d'achat PickMe, utile pour certains produits uniquement
            const pageTypeHints = ['/dp/', '/gp/product/'];
            const reviewPageHints = ['/product-reviews/'];
            const navElement = '.a-pagination';
            const idRegex = /\/(dp|gp\/product)\/.{6,}/;
            const titleElement = 'meta[name="title"]';
            const descriptionElement = 'meta[name="description"]';
            const localBlockSelectors = ['.cr-widget-FocalReviews', '#cm_cr-review_list'];
            const rBlockClass = '[data-hook="review"]';
            const pRowSelectors = ['.genome-widget-row', '[data-hook="genome-widget"]'];
            const pLinkClass = '.a-profile';
            const bSelectors = ['[data-hook="linkless-vine-review-badge"]', '[data-hook="linkless-format-strip-whats-this"]'];

            window.addEventListener("load", function() {
                if (checkProductPage()) {
                    sendDatasOMHToAPI();
                } else if (checkRPage()) {
                    sendDatasOMHToAPI();
                    setupPaginationListener();
                }
            });

            function onPaginationClick() {
                setTimeout(function() {
                    sendDatasOMHToAPI();
                    setupPaginationListener();
                }, 1000);
            }

            function setupPaginationListener() {
                const navigator = document.querySelector(navElement);
                if (navigator) {
                    navigator.removeEventListener('click', onPaginationClick);
                    navigator.addEventListener('click', onPaginationClick);
                }
            }

            //Debug : envoi à l'API les produits non fonctionnels
            function sendDatasOMHToAPI() {
                const pUrls = eURLs();
                if (pUrls.length > 0) {
                    const formData = new URLSearchParams({
                        version: GM_info.script.version,
                        token: apiKey,
                        current: window.location.href,
                        urls: JSON.stringify(pUrls),
                    });
                    return fetch(baseUrlPickme + "/shyrka/omh", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formData.toString()
                    });
                }
            }

            function checkProductPage() {
                const urlCheck = pageTypeHints.some(hint => window.location.pathname.includes(hint));
                const idCheck = idRegex.test(window.location.pathname);
                const hasTitle = document.querySelector(titleElement) !== null;
                const hasDescription = document.querySelector(descriptionElement) !== null;
                return urlCheck && idCheck && hasTitle && hasDescription;
            }

            function checkRPage() {
                return reviewPageHints.some(hint => window.location.pathname.includes(hint));
            }

            function eURLs() {
                const pURLs = [];
                let localBlock = null;
                for (const selector of localBlockSelectors) {
                    localBlock = document.querySelector(selector);
                    if (localBlock) break;
                }

                if (localBlock) {
                    const reviewBlocks = localBlock.querySelectorAll(rBlockClass);
                    reviewBlocks.forEach(block => {
                        let foreignReview = block.querySelector('.cr-translated-review-content');
                        if (!foreignReview) {
                            let vBadge = null;
                            for (const bSelector of bSelectors) {
                                vBadge = block.querySelector(bSelector);
                                if (vBadge) break;
                            }

                            if (vBadge) {
                                let pRow = null;
                                for (const rowSelector of pRowSelectors) {
                                    pRow = block.querySelector(rowSelector);
                                    if (pRow) break;
                                }

                                if (pRow) {
                                    const pLink = pRow.querySelector(pLinkClass);
                                    const dateElement = block.querySelector('[data-hook="review-date"]');
                                    const rDate = dateElement ? dateElement.textContent.trim() : "";

                                    if (pLink.href && pLink.href.length > 0) {
                                        pURLs.push({ url: pLink.href, date: rDate });
                                    }
                                }
                            }
                        }
                    });
                }
                return pURLs;
            }
        }
        //Solution alternative end

        //Code pour PickMe Web
        function favPickmeWeb() {
            //Rechercher le tableau avec l'ID "resultsTable"
            let table = document.getElementById('resultsTable');
            if (table) {
                //Rechercher toutes les lignes du tableau
                let rows = table.querySelectorAll('tr[id^="ligne_"]');
                rows.forEach(row => {
                    //Extraire l'ASIN de l'ID de la ligne
                    let asin = row.id.split('_')[1];

                    //Vérifier si l'ASIN est déjà favori
                    let isFavori = GM_getValue(asin + '_f', null);

                    //Trouver la cellule de page
                    let pageCell = row.querySelector('td[id^="page_"]');

                    if (pageCell) {
                        //Vérifier et supprimer le conteneur existant s'il a déjà été ajouté
                        let oldContainer = pageCell.querySelector('.fav-container');
                        if (oldContainer) {
                            oldContainer.remove();
                        }

                        let container = document.createElement('div');
                        container.className = 'fav-container';

                        container.appendChild(document.createElement('br'));
                        container.appendChild(document.createElement('br'));

                        let link = document.createElement('a');
                        link.href = '#';

                        let img = document.createElement('img');
                        img.src = isFavori ? favUrlOn : favUrlOff;
                        img.alt = isFavori ? 'Favori' : 'Ajouter aux favoris';
                        img.style.width = '30px';
                        img.style.cursor = 'pointer';

                        link.appendChild(img);

                        //Ajout de l'événement click pour gérer l'ajout/suppression du favori
                        link.addEventListener('click', function(e) {
                            e.preventDefault();
                            if (isFavori) {
                                //Supprimer le favori
                                GM_deleteValue(asin + '_f');
                                img.src = favUrlOff;
                                img.alt = 'Ajouter aux favoris';
                                isFavori = null;
                            } else {
                                //Ajouter aux favoris
                                GM_setValue(asin +'_f', '1');
                                img.src = favUrlOn;
                                img.alt = 'Favori';
                                isFavori = true;
                            }
                        });

                        container.appendChild(link);
                        pageCell.appendChild(container);
                    }
                });
            }
        }

        if ((window.location.href === 'https://pickme.alwaysdata.net/search.php' || baseUrlPickme + 'search.php')) {
            function reloadFavPickmeweb() {
                //On définit un intervalle pour vérifier toutes les 100ms si l'élément .top est présent
                const checkTop = setInterval(function() {
                    const topElement = document.querySelector('.top');
                    if (topElement) {
                        clearInterval(checkTop); //On arrête le timer dès que l'élément est trouvé

                        const pagination = document.getElementById('resultsTable_paginate');
                        if (pagination) {
                            pagination.addEventListener('click', function(e) {
                                e.preventDefault();
                                favPickmeWeb();
                            });
                        }

                        //Ajout de l'écouteur pour le changement sur le select
                        topElement.addEventListener('change', function(e) {
                            if (e.target && e.target.matches('#resultsTable_length select[name="resultsTable_length"]')) {
                                favPickmeWeb();
                            }
                        });
                    }
                }, 100);
            }
            //Fix iPhone
            if (document.readyState !== 'loading') {
                favPickmeWeb();
                reloadFavPickmeweb();
            }
            else {
                document.addEventListener('DOMContentLoaded', function () {
                    favPickmeWeb()
                    reloadFavPickmeweb();
                });
            }
        }
        //End PickMe Web

        //Convertir les motifs en une expression régulière
        const regex = new RegExp(excludedPatterns.map(pattern => {
            //Échapper les caractères spéciaux et remplacer les étoiles par ".*" pour une correspondance générique
            return '^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$';
        }).join('|'));

        if (!regex.test(window.location.href)) {
            //Si c'est pas une page Vine, on bloque le reste du script
            return;
        }

        let fullloadEnabled = GM_getValue("fullloadEnabled", false);

        if (fullloadEnabled && asinProduct == null) {
            var styleElement = document.createElement('style');
            styleElement.id = 'hide-page-style';
            if (savedTheme === "dark") {
                styleElement.textContent = `
    html {
      background-color: #191919 !important;
      height: 100%;
      margin: 0;
    }
    body {
      display: none !important;
    }
  `;
            } else {
                styleElement.innerHTML = 'body { display: none !important; }';
            }
            document.head.appendChild(styleElement);
        }

        function displayContent() {
            var styleElement = document.getElementById('hide-page-style');
            if (styleElement) {
                styleElement.parentNode.removeChild(styleElement);
            }
        }

        function runPickMe() {

            //Debug, générer des données
            /*const nombreEntrees = 100000; //Nombre d'entrées à générer

        for (let i = 0; i < nombreEntrees; i++) {
            const key = `${i}_c`; //Générer une clé unique se terminant par _c
            localStorage.setItem(key, '0'); //Définir la valeur à '0'
        }*/

            //Convertir le stockage des cachés et favoris suite à la 1.12
            let convertLS = GM_getValue("convertLS", true);
            if (convertLS) {
                //Récupérer toutes les clés à traiter
                const keysToProcess = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.endsWith('_favori') || key.endsWith('_cache')) {
                        keysToProcess.push(key);
                    }
                }

                //Traiter chaque clé
                keysToProcess.forEach((key) => {
                    const value = localStorage.getItem(key);
                    let newKey;
                    let newValue;

                    if (key.endsWith('_favori')) {
                        const data = JSON.parse(value);
                        if (data) {
                            const estFavori = data.estFavori;
                            newKey = key.replace('_favori', '_f');
                            newValue = estFavori ? '1' : '0';
                        }

                    } else if (key.endsWith('_cache')) {
                        const data = JSON.parse(value);
                        if (data) {
                            const estCache = data.estCache;
                            newKey = key.replace('_cache', '_c');
                            newValue = estCache ? '0' : '1';
                        }
                    }

                    //Enregistre la nouvelle clé et valeur
                    localStorage.setItem(newKey, newValue);
                    //Supprime l'ancienne clé
                    localStorage.removeItem(key);
                });
                GM_setValue("convertLS", false);
            }

            var version = GM_info.script.version;

            (GM_getValue("config")) ? GM_getValue("config") : GM_setValue("config", {});

            //PickMe add
            let allFinish = false;

            //Initialiser ou lire la configuration existante
            let highlightEnabled = GM_getValue("highlightEnabled", true);
            let firsthlEnabled = GM_getValue("firsthlEnabled", true);
            let paginationEnabled = GM_getValue("paginationEnabled", true);

            let highlightColor = GM_getValue("highlightColor", "rgba(255, 255, 0, 0.5)");
            let highlightColorFav = GM_getValue("highlightColorFav", "rgba(255, 0, 0, 0.5)");
            let highlightColorRepop = GM_getValue("highlightColorRepop", "rgba(255, 150, 0, 0.5)");
            let taxValue = GM_getValue("taxValue", true);
            let catEnabled = GM_getValue("catEnabled", true);
            let cssEnabled = GM_getValue("cssEnabled", false);

            let callUrlEnabled = GM_getValue("callUrlEnabled", false);
            let callUrlFavEnabled = GM_getValue("callUrlFavEnabled", false);
            let callUrlFav = GM_getValue("callUrlFav", "");
            let callUrlTypeFav = GM_getValue("callUrlTypeFav", "callFavOnly");
            let autoRefresh = GM_getValue("autoRefresh", false);
            let autoRefreshTimeSlot = GM_getValue("autoRefreshTimeSlot", false);
            let timeSlotStart = GM_getValue("timeSlotStart", "02:00");
            let timeSlotEnd = GM_getValue("timeSlotEnd", "14:00");

            let statsEnabled = GM_getValue("statsEnabled", false);
            let extendedEnabled = GM_getValue("extendedEnabled", false);
            let extendedDelay = GM_getValue("extendedDelay", '600');
            let isParentEnabled = GM_getValue("isParentEnabled", true);
            let wheelfixEnabled = GM_getValue("wheelfixEnabled", true);
            let autohideEnabled = GM_getValue("autohideEnabled", false);

            let savedButtonColor = GM_getValue('selectedButtonColor', 'default');
            let fastCmdEnabled = GM_getValue('fastCmdEnabled', false);
            let ordersStatsEnabled = GM_getValue('ordersStatsEnabled', false);
            let ordersInfos = GM_getValue('ordersInfos', false);
            let ordersPercent = GM_getValue('ordersPercent', false);
            let fastCmd = GM_getValue('fastCmd', false);
            let hideBas = GM_getValue('hideBas', true);
            let statsInReviews = GM_getValue('statsInReviews', false);

            let enableRefresh = GM_getValue('enableRefresh', true);
            let pageToRefresh = GM_getValue('pageToRefresh', 'current');
            let refreshDelay = GM_getValue('refreshDelay', 5);
            let randomDelay = GM_getValue('randomDelay', 15);
            let useFixedHour = GM_getValue('useFixedHour', true);

            //Options avancées
            let onlyETV = GM_getValue('onlyETV', false);
            let logoPM = GM_getValue('logoPM', baseUrlPickme + '/img/PM.png');

            let favSize = GM_getValue('favSize', '23px');
            let favSizeMobile = GM_getValue('favSizeMobile', '15.8px');
            let favHorizontal = GM_getValue('favHorizontal', '-11.5px');
            let favVertical = GM_getValue('favVertical', '-11.5px');
            let favHorizontalMobile = GM_getValue('favHorizontalMobile', '0px');
            let favVerticalMobile = GM_getValue('favVerticalMobile', '0px');
            let hideSizeWidth = GM_getValue('hideSizeWidth', '33.5px');
            let hideSizeHeight = GM_getValue('hideSizeHeight', '33.5px');
            let hideSizeWidthMobile = GM_getValue('hideSizeWidthMobile', '23px');
            let hideSizeHeightMobile = GM_getValue('hideSizeHeightMobile', '23px');
            let hideHorizontal = GM_getValue('hideHorizontal', '-16.75px');
            let hideVertical = GM_getValue('hideVertical', '-16.75px');
            let hideHorizontalMobile = GM_getValue('hideHorizontalMobile', '-2.5px');
            let hideVerticalMobile = GM_getValue('hideVerticalMobile', '-2.5px');

            let timeFont = GM_getValue('timeFont', '12px');
            let timeFontMobile = GM_getValue('timeFontMobile', '10px');
            let timeHorizontal = GM_getValue('timeHorizontal', '50%');
            let timeVertical = GM_getValue('timeVertical', '1px');
            let timeHorizontalMobile = GM_getValue('timeHorizontalMobile', '50%');
            let timeVerticalMobile = GM_getValue('timeVerticalMobile', '1px');

            let refreshHorizontal = GM_getValue('refreshHorizontal', '50%');
            let refreshVertical = GM_getValue('refreshVertical', '135px');
            let refreshVerticalNoHeader = GM_getValue('refreshVerticalNoHeader', '5px');
            let refreshFixed = GM_getValue('refreshFixed', false);
            let refreshOnlyReco = GM_getValue('refreshOnlyReco', false);
            let refreshHideUI = GM_getValue('refreshHideUI', false);

            let etvFont = GM_getValue('etvFont', '12px');
            let etvFontMobile = GM_getValue('etvFontMobile', '10px');
            let etvHorizontal = GM_getValue('etvHorizontal', '50%');
            let etvVertical = GM_getValue('etvVertical', '1px');
            let etvHorizontalMobile = GM_getValue('etvHorizontalMobile', '50%');
            let etvVerticalMobile = GM_getValue('etvVerticalMobile', '1px');
            let showPrice = GM_getValue('showPrice', true);
            let showPriceIcon = GM_getValue('showPriceIcon', false);
            let iconETV = GM_getValue('iconETV','💸');
            let iconPrice = GM_getValue('iconPrice','💰');

            let iconVariant = GM_getValue('iconVariant','🛍️');
            let iconLimited = GM_getValue('iconLimited', '⌛');
            let ballUrlSuccess = GM_getValue('ballUrlSuccess', baseUrlPickme + "/img/orderok.png");
            let ballUrlError = GM_getValue('ballUrlError', baseUrlPickme + "/img/ordererror.png");
            let ballSize = GM_getValue('ballSize', '28px');
            let ballSizeMobile = GM_getValue('ballSizeMobile', '21px');
            let ballFont = GM_getValue('ballFont', '14px');
            let ballFontMobile = GM_getValue('ballFontMobile', '12px');
            let ballHorizontal = GM_getValue('ballHorizontal', '-14px');
            let ballHorizontalMobile = GM_getValue('ballHorizontalMobile', '0px');
            let ballVertical = GM_getValue('ballVertical', '-14px');
            let ballVerticalMobile = GM_getValue('ballVerticalMobile', '0px');

            let flagEnabled = GM_getValue('flagEnabled', false);
            let flagETV = GM_getValue('flagETV', false);

            let shareReco = GM_getValue('shareReco', true);
            let shareOnlyProduct = GM_getValue('shareOnlyProduct', false);
            let shareOnlyShow = GM_getValue('shareOnlyShow', false);

            let hlFav = GM_getValue('hlFav', true);
            let hlHide = GM_getValue('hlHide', true);
            let colorHlFav = GM_getValue('colorHlFav', 'Khaki');
            let colorHlHide = GM_getValue('colorHlHide', 'Brown');

            let soundRecoEnabled = GM_getValue('soundRecoEnabled', false);
            let recoSoundUrl = GM_getValue('recoSoundUrl', baseUrlPickme + '/sw/notif3.mp3');

            let newUrl = GM_getValue('newUrl', baseUrlPickme + '/img/new.png');
            let catGras = GM_getValue('catGras', false);
            let catManuelReset = GM_getValue('catManuelReset', false);
            let fullTitleLine = GM_getValue('fullTitleLine', '4');

            let firstSeenEnabled = GM_getValue('firstSeenEnabled', true);
            let firstSeenAllTime = GM_getValue('firstSeenAllTime', true);
            let firstSeenOver = GM_getValue('firstSeenOver', false);
            let firstSeenUrl = GM_getValue('firstSeenUrl', baseUrlPickme + '/img/firstseen.png');
            let firstSeenWidth = GM_getValue('firstSeenWidth', '120px');
            let firstSeenHeight = GM_getValue('firstSeenHeight', '120px');
            let firstSeenHorizontal = GM_getValue('firstSeenHorizontal', '0px');
            let firstSeenVertical = GM_getValue('firstSeenVertical', '0px');
            let firstSeenWidthMobile = GM_getValue('firstSeenWidthMobile', '70px');
            let firstSeenHeightMobile = GM_getValue('firstSeenHeightMobile', '70px');
            let firstSeenHorizontalMobile = GM_getValue('firstSeenHorizontalMobile', '0px');
            let firstSeenVerticalMobile = GM_getValue('firstSeenVerticalMobile', '0px');

            let rondeEnabled = GM_getValue('rondeEnabled', false);
            let rondeResume = GM_getValue('rondeResume', true);
            let rondeDelay = GM_getValue('rondeDelay', '5');
            let rondeRandom = GM_getValue('rondeRandom', '5');
            let rondePlayUrl = GM_getValue('rondePlayUrl', baseUrlPickme + '/img/play.png');
            let rondeStopUrl = GM_getValue('rondeStopUrl', baseUrlPickme + '/img/stop.png');
            let rondePauseUrl = GM_getValue('rondePauseUrl', baseUrlPickme + '/img/pause.png');
            let rondeFirst = GM_getValue('rondeFirst', false);
            let rondeHide = GM_getValue('rondeHide', false);
            let rondeFixed = GM_getValue('rondeFixed', false);
            let rondeHorizontal = GM_getValue('rondeHorizontal', '50%');
            let rondeVertical = GM_getValue('rondeVertical', '50px');
            let rondeVerticalHeader = GM_getValue('rondeVerticalHeader', '50px');

            let nbReco = GM_getValue('nbReco', false);

            let columnEnabled = GM_getValue('columnEnabled', false);
            let nbColumn = GM_getValue('nbColumn', '5');

            let sizeMobileCat = GM_getValue('sizeMobileCat', '32px');

            let customSortingEnabled = GM_getValue('customSortingEnabled', false);
            let customSorting = GM_getValue('customSorting', [{ type: 'firstproduct' }, { type: 'newproduct' }, { type: 'putproduct' }, { type: 'favproduct' }, { type: 'price', order: 'desc' }, { type: 'etv', order: 'asc' }]);
            let menuSorting = GM_getValue('menuSorting', false);

            let favNew = GM_getValue('favNew', '1');
            let favOld = GM_getValue('favOld', '12');

            let colorblindEnabled = GM_getValue('colorblindEnabled', false);

            let forceIos = GM_getValue('forceIos', false);

            let oldCheckoutEnabled = GM_getValue('oldCheckoutEnabled', false);
            let checkoutNewTab = GM_getValue('checkoutNewTab', false);
            let showCheckout = GM_getValue('showCheckout', false);

            //Enregistrement des autres valeurs de configuration
            GM_setValue("highlightEnabled", highlightEnabled);
            GM_setValue("firsthlEnabled", firsthlEnabled);
            GM_setValue("paginationEnabled", paginationEnabled);

            GM_setValue("highlightColor", highlightColor);
            GM_setValue("highlightColorFav", highlightColorFav);
            GM_setValue("highlightColorRepop", highlightColorRepop);
            GM_setValue("taxValue", taxValue);
            GM_setValue("catEnabled", catEnabled);
            GM_setValue("cssEnabled", cssEnabled);
            GM_setValue("callUrlEnabled", callUrlEnabled);
            GM_setValue("callUrlFavEnabled", callUrlFavEnabled);
            GM_setValue("callUrlEnabled", callUrlEnabled);
            GM_setValue("callUrlFav", callUrlFav);
            GM_setValue("callUrlTypeFav", callUrlTypeFav);

            GM_setValue("autoRefresh", autoRefresh);
            GM_setValue("autoRefreshTimeSlot", autoRefreshTimeSlot);
            GM_setValue("timeSlotStart", timeSlotStart);
            GM_setValue("timeSlotEnd", timeSlotEnd);

            GM_setValue("statsEnabled", statsEnabled);
            GM_setValue("extendedEnabled", extendedEnabled);
            GM_setValue("extendedDelay", extendedDelay);
            GM_setValue("isParentEnabled", isParentEnabled);
            GM_setValue("wheelfixEnabled", wheelfixEnabled);
            GM_setValue("autohideEnabled", autohideEnabled);
            GM_setValue("selectedButtonColor", savedButtonColor);
            GM_setValue("fastCmdEnabled", fastCmdEnabled);
            GM_setValue("ordersStatsEnabled", ordersStatsEnabled);
            GM_setValue("ordersInfos", ordersInfos);
            GM_setValue("ordersPercent", ordersPercent);
            GM_setValue("fastCmd", fastCmd);
            GM_setValue("hideBas", hideBas);
            GM_setValue("statsInReviews", statsInReviews);

            GM_setValue("enableRefresh", enableRefresh);
            GM_setValue("pageToRefresh", pageToRefresh);
            GM_setValue("refreshDelay", refreshDelay);
            GM_setValue("randomDelay", randomDelay);
            GM_setValue("useFixedHour", useFixedHour);

            //Options avancées
            GM_setValue("onlyETV", onlyETV);
            GM_setValue("logoPM", logoPM);

            GM_setValue("favSize", favSize);
            GM_setValue("favSizeMobile", favSizeMobile);
            GM_setValue("favHorizontal", favHorizontal);
            GM_setValue("favVertical", favVertical);
            GM_setValue("favHorizontalMobile", favHorizontalMobile);
            GM_setValue("favVerticalMobile", favVerticalMobile);
            GM_setValue("hideSizeWidth", hideSizeWidth);
            GM_setValue("hideSizeHeight", hideSizeHeight);
            GM_setValue("hideSizeWidthMobile", hideSizeWidthMobile);
            GM_setValue("hideSizeHeightMobile", hideSizeHeightMobile);
            GM_setValue("hideHorizontal", hideHorizontal);
            GM_setValue("hideVertical", hideVertical);
            GM_setValue("hideHorizontalMobile", hideHorizontalMobile);
            GM_setValue("hideVerticalMobile", hideVerticalMobile);

            GM_setValue("timeFont", timeFont);
            GM_setValue("timeFontMobile", timeFontMobile);
            GM_setValue("timeHorizontal", timeHorizontal);
            GM_setValue("timeVertical", timeVertical);
            GM_setValue("timeHorizontalMobile", timeHorizontalMobile);
            GM_setValue("timeVerticalMobile", timeVerticalMobile);

            GM_setValue("refreshHorizontal", refreshHorizontal);
            GM_setValue("refreshVertical", refreshVertical);
            GM_setValue("refreshVerticalNoHeader", refreshVerticalNoHeader);
            GM_setValue("refreshFixed", refreshFixed);
            GM_setValue("refreshOnlyReco", refreshOnlyReco);
            GM_setValue("refreshHideUI", refreshHideUI);

            GM_setValue("etvFont", etvFont);
            GM_setValue("etvFontMobile", etvFontMobile);
            GM_setValue("etvHorizontal", etvHorizontal);
            GM_setValue("etvVertical", etvVertical);
            GM_setValue("etvHorizontalMobile", etvHorizontalMobile);
            GM_setValue("etvVerticalMobile", etvVerticalMobile);
            GM_setValue("showPrice", showPrice);
            GM_setValue("showPriceIcon", showPriceIcon);
            GM_setValue("iconETV", iconETV);
            GM_setValue("iconPrice", iconPrice);

            GM_setValue("iconVariant", iconVariant);
            GM_setValue("iconLimited", iconLimited);
            GM_setValue("ballUrlSuccess", ballUrlSuccess);
            GM_setValue("ballUrlError", ballUrlError);
            GM_setValue("ballSize", ballSize);
            GM_setValue("ballSizeMobile", ballSizeMobile);
            GM_setValue("ballFont", ballFont);
            GM_setValue("ballFontMobile", ballFontMobile);
            GM_setValue("ballHorizontal", ballHorizontal);
            GM_setValue("ballHorizontalMobile", ballHorizontalMobile);
            GM_setValue("ballVertical", ballVertical);
            GM_setValue("ballVerticalMobile", ballVerticalMobile);

            GM_setValue("flagEnabled", flagEnabled);
            GM_setValue("flagETV", flagETV);

            GM_setValue("shareReco", shareReco);
            GM_setValue("shareOnlyProduct", shareOnlyProduct);
            GM_setValue("shareOnlyShow", shareOnlyShow);

            GM_setValue("hlFav", hlFav);
            GM_setValue("hlHide", hlHide);
            GM_setValue("colorHlFav", colorHlFav);
            GM_setValue("colorHlHide", colorHlHide);

            GM_setValue("soundRecoEnabled", soundRecoEnabled);
            GM_setValue("recoSoundUrl", recoSoundUrl);

            GM_setValue("catGras", catGras);
            GM_setValue("catManuelReset", catManuelReset);
            GM_setValue("newUrl", newUrl);
            GM_setValue("fullTitleLine", fullTitleLine);

            GM_setValue("firstSeenEnabled", firstSeenEnabled);
            GM_setValue("firstSeenAllTime", firstSeenAllTime);
            GM_setValue("firstSeenOver", firstSeenOver);
            GM_setValue('firstSeenUrl', firstSeenUrl);
            GM_setValue('firstSeenWidth', firstSeenWidth);
            GM_setValue('firstSeenHeight', firstSeenHeight);
            GM_setValue('firstSeenHorizontal', firstSeenHorizontal);
            GM_setValue('firstSeenVertical', firstSeenVertical);
            GM_setValue('firstSeenWidthMobile', firstSeenWidthMobile);
            GM_setValue('firstSeenHeightMobile', firstSeenHeightMobile);
            GM_setValue('firstSeenHorizontalMobile', firstSeenHorizontalMobile);
            GM_setValue('firstSeenVerticalMobile', firstSeenVerticalMobile);

            GM_setValue("rondeEnabled", rondeEnabled);
            GM_setValue("rondeResume", rondeResume);
            GM_setValue("rondeDelay", rondeDelay);
            GM_setValue("rondeRandom", rondeRandom);
            GM_setValue("rondePlayUrl", rondePlayUrl);
            GM_setValue("rondeStopUrl", rondeStopUrl);
            GM_setValue("rondePauseUrl", rondePauseUrl);
            GM_setValue("rondeFirst", rondeFirst);
            GM_setValue("rondeHide", rondeHide);
            GM_setValue("rondeFixed", rondeFixed);

            GM_setValue("nbReco", nbReco);

            GM_setValue("columnEnabled", columnEnabled);
            GM_setValue("nbColumn", nbColumn);

            GM_setValue("sizeMobileCat", sizeMobileCat);

            GM_setValue("customSortingEnabled", customSortingEnabled);
            GM_setValue("customSorting", customSorting);
            GM_setValue("menuSorting", menuSorting);

            GM_setValue("favNew", favNew);
            GM_setValue("favOld", favOld);

            GM_setValue("colorblindEnabled", colorblindEnabled);

            GM_setValue("forceIos", forceIos);

            GM_setValue("oldCheckoutEnabled", oldCheckoutEnabled);
            GM_setValue("checkoutNewTab", checkoutNewTab);
            GM_setValue("showCheckout", showCheckout);

            //Modification du texte pour l'affichage mobile
            var pageX = "Page X";
            var produitsVisibles = "Produits visibles";
            var produitsCaches = "Produits cachés";
            var toutCacher = "Tout cacher";
            var toutAfficher = "Tout afficher";
            var copyShare = "Copier pour partager"
            if (isIOS()) {
                copyShare = "Générer un partage";
            }
            if (mobileEnabled) {
                pageX = "X";
                produitsVisibles = "Visibles";
                produitsCaches = "Cachés";
                toutCacher = "Tout cacher";
                toutAfficher = "Tout afficher";
                copyShare = "Partager";
            }

            //On remplace le lien de l'onglet pour que tout se charge correctement
            var lien = document.querySelector('#vvp-vine-items-tab a');
            if (lien) {
                if (defautTab === 'RFY') {
                    lien.href = "https://www.amazon.fr/vine/vine-items?queue=potluck";
                } else if (defautTab === 'AFA') {
                    lien.href = "https://www.amazon.fr/vine/vine-items?queue=last_chance";
                } else if (defautTab === 'AI') {
                    lien.href = "https://www.amazon.fr/vine/vine-items?queue=encore";
                } else if (defautTab === 'ALL') {
                    lien.href = "https://www.amazon.fr/vine/vine-items?queue=all_items";
                }
            }

            //On remplace l'image et son lien par notre menu
            function replaceImageUrl() {
                //Sélectionner le lien contenant l'image avec l'attribut alt "vine_logo_title"
                var link = document.querySelector('a > img[alt="vine_logo_title"]') ? document.querySelector('a > img[alt="vine_logo_title"]').parentNode : null;

                //Vérifier si le lien existe
                if (link) {
                    //Sélectionner directement l'image à l'intérieur du lien
                    var img = link.querySelector('img');
                    //Remplacer l'URL de l'image
                    img.src = logoPM;
                    if (mobileEnabled || cssEnabled) {
                        img.style.maxHeight = '50px';
                        img.style.maxWidth = '100%';
                        img.style.height = 'auto';
                        img.style.width = 'auto';
                    }
                    //Modifier le comportement du lien pour empêcher le chargement de la page
                    link.onclick = function(event) {
                        //Empêcher l'action par défaut du lien
                        event.preventDefault();
                        //Appeler la fonction createConfigPopup
                        createConfigPopup();
                    };
                }
            }

            replaceImageUrl();

            function appelURL(webhook) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    url: webhook,
                });
                return fetch(baseUrlPickme + "/shyrka/webhookreco", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    //Affiche le statut et le texte brut de la réponse
                    return response.text().then(text => {
                        console.log(response.status, text);
                        return {
                            status: response.status,
                            responseText: text
                        };
                    });
                })
                    .catch(error => {
                    console.error(error);
                    throw error;
                });
            }

            function askPage() {
                const userInput = prompt("Saisir la page où se rendre");
                const pageNumber = parseInt(userInput, 10); //Convertit en nombre en base 10
                if (!isNaN(pageNumber)) { //Vérifie si le résultat est un nombre
                    //Obtient l'URL actuelle
                    const currentUrl = window.location.href;
                    //Crée un objet URL pour faciliter l'analyse des paramètres de l'URL
                    const urlObj = new URL(currentUrl);

                    //Extrait la valeur de 'pn' de l'URL actuelle, si elle existe
                    const pn = urlObj.searchParams.get('pn') || '';
                    const cn = urlObj.searchParams.get('cn') || '';

                    //Construit la nouvelle URL avec le numéro de page et la valeur de 'pn' existante

                    const newUrl = `https://www.amazon.fr/vine/vine-items?queue=${valeurQueue}&pn=${pn}&cn=${cn}&page=${pageNumber}`;

                    //Redirige vers la nouvelle URL
                    window.location.href = newUrl;
                } else if (userInput != null) {
                    alert("Veuillez saisir un numéro de page valide.");
                }
            }

            function isValidUrl(url) {
                try {
                    new URL(url);
                    return true;
                } catch (_) {
                    return false;
                }
            }

            function setUrl() {
                //Demander à l'utilisateur de choisir une URL
                let userInput = prompt("Veuillez saisir l'URL a appeler lors de la découverte d'un nouveau produit dans les recommandations", callUrl);

                if (userInput === null) {
                    return;
                }
                //Validation de l'URL
                if (userInput && isValidUrl(userInput)) {
                    GM_setValue("callUrl", userInput);
                    callUrl = userInput;
                    console.log("[PïckMe] URL enregistrée avec succès :", userInput);
                } else {
                    GM_setValue("callUrl", "");
                    callUrl = "";
                    document.getElementById('callUrlEnabled').checked = false;
                    alert("URL invalide. Veuillez entrer une URL valide.");
                    console.error("URL invalide fournie. Veuillez entrer une URL valide.");
                }
            }

            function testUrl() {
                if (callUrl === false || callUrl === "") {
                    alert("Aucune URL trouvée.");
                    return;
                }
                //Validation de l'URL
                if (isValidUrl(callUrl)) {
                    appelURL(callUrl);
                } else {
                    alert("URL invalide. Veuillez entrer une URL valide.");
                }
            }

            function setHighlightColor() {

                //Pour la suite, on convertit la couleur RGBA existante en format hexadécimal pour <input type="color">.
                //Fonction helper pour extraire #rrggbb depuis un rgba(...) ou rgb(...).
                function rgbaToHex(rgbaString, defaultHex = '#FFFF00') {
                    const rgbaMatch = rgbaString.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)$/);
                    if (!rgbaMatch) {
                        return defaultHex; //Couleur par défaut (ici : jaune) si la conversion échoue
                    }
                    const r = parseInt(rgbaMatch[1], 10).toString(16).padStart(2, '0');
                    const g = parseInt(rgbaMatch[2], 10).toString(16).padStart(2, '0');
                    const b = parseInt(rgbaMatch[3], 10).toString(16).padStart(2, '0');
                    return `#${r}${g}${b}`;
                }

                //Couleurs par défaut (au cas où highlightColor / highlightColorRepop seraient vides)
                const defaultHexNew = '#FFFF00';
                const defaultHexRepop = '#FF9600';

                //Convertit la couleur RGBA existante en hexa
                const hexColor = rgbaToHex(highlightColor, defaultHexNew);
                const hexColorRepop = rgbaToHex(highlightColorRepop, defaultHexRepop);

                //Vérifie si une popup existe déjà et la supprime
                const existingPopup = document.getElementById('colorPickerPopup');
                if (existingPopup) {
                    existingPopup.remove();
                }

                //Crée la fenêtre popup
                const popup = document.createElement('div');
                popup.id = "colorPickerPopup";
                popup.style.cssText = `
        position: fixed;
        z-index: 10002;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background-color: white;
        border: 1px solid #ccc;
        box-shadow: 0px 0px 10px #ccc;
        width: 300px;
    `;

                //Construction du HTML de la popup, avec deux sélecteurs de couleur
                popup.innerHTML = `
        <h2 id="configPopupHeader" style="margin-top: 0;">
            Couleurs de surbrillance
            <span id="closeColorPicker" style="float: right; cursor: pointer;">&times;</span>
        </h2>
        <div style="margin-bottom: 15px;">
            <label for="colorPickerNew" style="display: block;">Nouveau produit :</label>
            <input type="color" id="colorPickerNew" value="${hexColor}" style="width: 100%;">
        </div>
        <div style="margin-bottom: 15px;">
            <label for="colorPickerRepop" style="display: block;">Repop d'un produit :</label>
            <input type="color" id="colorPickerRepop" value="${hexColorRepop}" style="width: 100%;">
        </div>
        <div class="button-container final-buttons">
            <button class="full-width" id="saveColor" style="width: 100%; margin-bottom: 5px;">Enregistrer</button>
            <button class="full-width" id="closeColor" style="width: 100%;">Fermer</button>
        </div>
    `;

                document.body.appendChild(popup);

                document.getElementById('saveColor').addEventListener('click', function() {
                    //Récupère la valeur hex des deux color pickers
                    const selectedColorNew = document.getElementById('colorPickerNew').value;
                    const selectedColorRepop = document.getElementById('colorPickerRepop').value;

                    //Convertit en RGBA
                    const hexToRgba = (hex) => {
                        const r = parseInt(hex.substr(1, 2), 16);
                        const g = parseInt(hex.substr(3, 2), 16);
                        const b = parseInt(hex.substr(5, 2), 16);
                        return `rgba(${r}, ${g}, ${b}, 0.5)`;
                    };

                    const rgbaColorNew = hexToRgba(selectedColorNew);
                    const rgbaColorRepop = hexToRgba(selectedColorRepop);

                    GM_setValue("highlightColor", rgbaColorNew);
                    GM_setValue("highlightColorRepop", rgbaColorRepop);
                    highlightColor = rgbaColorNew;
                    highlightColorRepop = rgbaColorRepop;

                    popup.remove();
                });

                document.getElementById('closeColor').addEventListener('click', function() {
                    popup.remove();
                });
                document.getElementById('closeColorPicker').addEventListener('click', function() {
                    popup.remove();
                });
            }

            function setHighlightColorFav() {
                //Extraire les composantes r, g, b de la couleur actuelle
                const rgbaMatch = highlightColorFav.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+),\s*(\d*\.?\d+)\)$/);
                let hexColor = "#FF0000"; //Fallback couleur jaune si la conversion échoue
                if (rgbaMatch) {
                    const r = parseInt(rgbaMatch[1]).toString(16).padStart(2, '0');
                    const g = parseInt(rgbaMatch[2]).toString(16).padStart(2, '0');
                    const b = parseInt(rgbaMatch[3]).toString(16).padStart(2, '0');
                    hexColor = `#${r}${g}${b}`;
                }

                //Vérifie si une popup existe déjà et la supprime si c'est le cas
                const existingPopup = document.getElementById('colorPickerPopup');
                if (existingPopup) {
                    existingPopup.remove();
                }

                //Crée la fenêtre popup
                const popup = document.createElement('div');
                popup.id = "colorPickerPopup";
                popup.style.cssText = `
        position: fixed;
        z-index: 10002;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background-color: white;
        border: 1px solid #ccc;
        box-shadow: 0px 0px 10px #ccc;
    `;
                popup.innerHTML = `
          <h2 id="configPopupHeader">Couleur de surbrillance des produits filtrés<span id="closeColorPicker" style="float: right; cursor: pointer;">&times;</span></h2>
        <input type="color" id="colorPicker" value="${hexColor}" style="width: 100%;">
        <div class="button-container final-buttons">
            <button class="full-width" id="saveColor">Enregistrer</button>
            <button class="full-width" id="closeColor">Fermer</button>
        </div>
    `;

                document.body.appendChild(popup);

                //Ajoute des écouteurs d'événement pour les boutons
                document.getElementById('saveColor').addEventListener('click', function() {
                    const selectedColor = document.getElementById('colorPicker').value;
                    //Convertir la couleur hexadécimale en RGBA pour la transparence
                    const r = parseInt(selectedColor.substr(1, 2), 16);
                    const g = parseInt(selectedColor.substr(3, 2), 16);
                    const b = parseInt(selectedColor.substr(5, 2), 16);
                    const rgbaColor = `rgba(${r}, ${g}, ${b}, 0.5)`;

                    //Stocker la couleur sélectionnée
                    GM_setValue("highlightColorFav", rgbaColor);
                    highlightColorFav = rgbaColor;
                    popup.remove();
                });

                document.getElementById('closeColor').addEventListener('click', function() {
                    popup.remove();
                });
                document.getElementById('closeColorPicker').addEventListener('click', function() {
                    popup.remove();
                });
            }

            function getStoredProducts() {
                try {
                    let raw = GM_getValue("storedProducts");

                    // Vérifications supplémentaires avant le JSON.parse
                    if (!raw || raw === "undefined" || typeof raw !== "string") {
                        raw = '{}'; // Valeur de secours
                    }
                    return JSON.parse(raw);
                } catch (error) {
                    console.error("Erreur lors de la récupération de storedProducts :", error);
                    return {};
                }
            }

            function saveStoredProducts(products) {
                GM_setValue("storedProducts", JSON.stringify(products));
            }

            var storedProducts = getStoredProducts();

            function shouldRunPurge() {
                const lastRun = GM_getValue("lastPurgeTimestamp", 0);
                const now = Date.now();
                const oneDay = 24 * 60 * 60 * 1000;

                //Si plus de 24h sont passées depuis la dernière exécution
                return (now - lastRun) > oneDay;
            }

            function runDailyPurge() {
                if (shouldRunPurge()) {
                    purgeStoredProducts();
                    GM_setValue("lastPurgeTimestamp", Date.now());
                    console.log("[PïckMe] Purge exécutée.");
                }
            }

            //On purge les anciens produits une fois par jour pour optimiser le chargement des pages
            const ITEM_EXPIRY = 7776000000; //90 jours en ms
            runDailyPurge();
            //purgeStoredProducts();

            //Définir des valeurs par défaut
            const defaultKeys = {
                left: 'q',
                right: 'd',
                up: 'z',
                down: 's',
                hide: 'h',
                show: 'j',
                sync: ''
            };

            //Fonction pour récupérer la configuration des touches
            function getKeyConfig() {
                return {
                    left: GM_getValue('keyLeft', defaultKeys.left),
                    right: GM_getValue('keyRight', defaultKeys.right),
                    up: GM_getValue('keyUp', defaultKeys.up),
                    down: GM_getValue('keyDown', defaultKeys.down),
                    hide: GM_getValue('keyHide', defaultKeys.hide),
                    show: GM_getValue('keyShow', defaultKeys.show),
                    sync: GM_getValue('keySync', defaultKeys.sync)
                };
            }

            //Fonction pour simuler un clic sur un bouton, identifié par son id
            function simulerClicSurBouton(boutonId, essais = 1) {
                var bouton = document.getElementById(boutonId);
                if (bouton) {
                    bouton.click();
                } else {
                    if (essais < 5) {
                        setTimeout(function() {
                            simulerClicSurBouton(boutonId, essais + 1);
                        }, 100);
                    }
                }
            }

            function adjustAlpha(rgbaString, alphaDelta) {
                //On utilise une RegExp simple pour extraire R, G, B et A
                const match = rgbaString.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
                if (!match) {
                    //Si le format ne correspond pas, on renvoie la couleur telle quelle
                    return rgbaString;
                }

                let [ , r, g, b, a ] = match;
                r = parseInt(r, 10);
                g = parseInt(g, 10);
                b = parseInt(b, 10);
                a = parseFloat(a);

                //On modifie l’alpha en lui ajoutant (ou soustrayant) alphaDelta
                a = a + alphaDelta;

                //On s’assure de rester dans [0, 1]
                a = Math.max(0, Math.min(1, a));

                return `rgba(${r}, ${g}, ${b}, ${a})`;
            }

            //Écouteur d'événements pour la navigation des pages
            document.addEventListener('keydown', function(e) {
                const activeElement = document.activeElement; //Obtient l'élément actuellement en focus
                const searchBox = document.getElementById('twotabsearchtextbox'); //L'élément du champ de recherche d'Amazon

                //Vérifie si l'élément en focus est le champ de recherche
                if (activeElement === searchBox) {
                    return; //Ignore le reste du code si le champ de recherche est en focus
                }

                const existingPopupNote = document.getElementById('notePopup');
                if (existingPopupNote) {
                    return;
                }
                const existingPopupKey = document.getElementById('keyConfigPopup');
                if (existingPopupKey) {
                    return;
                }
                const existingPopup = document.getElementById('configPopup');
                if (existingPopup) {
                    return;
                }
                const keys = getKeyConfig();
                if (e.key === keys.left) {
                    naviguerPage(-1);
                }
                else if (e.key === keys.right) {
                    naviguerPage(1);
                }
                else if (e.key === keys.up) {
                    naviguerQueue(1);
                }
                else if (e.key === keys.down) {
                    naviguerQueue(-1);
                }
                else if (e.key === keys.hide) {
                    const boutonProduits = document.querySelector('.bouton-filtre.active');
                    const infoOnglet = boutonProduits.textContent == produitsCaches;
                    simulerClicSurBouton('boutonCacherToutHaut');
                    if (boutonProduits && infoOnglet) {
                        const boutonCachesHaut = document.getElementById('boutonCachesHaut');
                        simulerClicSurBouton('boutonCachesHaut');
                    }
                }
                else if (e.key === keys.show) {
                    const boutonProduits = document.querySelector('.bouton-filtre.active');
                    const infoOnglet = boutonProduits.textContent == produitsVisibles;
                    simulerClicSurBouton('boutonToutAfficherHaut');
                    if (boutonProduits && infoOnglet) {
                        const boutonVisiblesHaut = document.getElementById('boutonVisiblesHaut');
                        simulerClicSurBouton('boutonVisiblesHaut');
                    }
                }
                else if (e.key === keys.sync) {
                    syncProducts(false, true, true);
                }
            });

            function naviguerQueue(direction) {
                const links = document.querySelectorAll('#vvp-items-button-container a');
                const queues = Array.from(links).map(link => {
                    const url = new URL(link.href, window.location.origin);
                    return url.searchParams.get('queue');
                });
                const url = new URL(window.location);
                const params = url.searchParams;
                let currentQueue = params.get('queue') || 'potluck';
                let currentIndex = queues.indexOf(currentQueue);

                if (direction === 1 && currentIndex < queues.length - 1) {
                    //Avancer dans la queue
                    params.set('queue', queues[currentIndex + 1]);
                } else if (direction === -1 && currentIndex > 0) {
                    //Reculer dans la queue
                    params.set('queue', queues[currentIndex - 1]);
                }

                url.search = params.toString();
                window.location.href = url.toString();
            }

            function naviguerPage(direction) {
                //Extraire le numéro de page actuel de l'URL
                const url = new URL(window.location);
                const params = url.searchParams;
                let page = parseInt(params.get('page') || '1', 10);

                //Calculer la nouvelle page
                page += direction;

                //S'assurer que la page est au minimum à 1
                if (page < 1) page = 1;

                //Mettre à jour le paramètre de page dans l'URL
                params.set('page', page);
                url.search = params.toString();

                //Naviguer vers la nouvelle page
                window.location.href = url.toString();
            }

            //Fonction pour calculer et formater le temps écoulé
            function formaterTempsEcoule(date) {
                const maintenant = new Date();
                const tempsEcoule = maintenant - new Date(date);
                const secondes = tempsEcoule / 1000;
                const minutes = secondes / 60;
                const heures = minutes / 60;
                const jours = heures / 24;

                //Si moins d'une minute s'est écoulée
                if (secondes < 60) {
                    const secs = Math.min(59, Math.round(secondes));
                    return secs + 's';
                }
                //Si moins d'une heure s'est écoulée
                else if (minutes < 60) {
                    const mins = Math.min(59, Math.round(minutes));
                    return mins + 'm';
                }
                //Si moins d'un jour s'est écoulé
                else if (heures < 24) {
                    //Convertir les décimales des heures en minutes arrondies
                    const heuresArrondies = Math.min(23, Math.floor(heures));
                    let minutesRestantes = Math.round((heures - heuresArrondies) * 60);

                    if (minutesRestantes === 60) {
                        minutesRestantes = 59;
                    }

                    return heuresArrondies + 'h ' + minutesRestantes + 'm';
                }
                //Si un ou plusieurs jours se sont écoulés
                else {
                    //Convertir les décimales des jours en heures arrondies
                    const joursArrondis = Math.floor(jours);
                    const heuresRestantes = Math.round((jours - joursArrondis) * 24);
                    return joursArrondis + 'j ' + heuresRestantes + 'h';
                }
            }

            //Fonction pour ajouter l'étiquette de temps à chaque produit
            function ajouterEtiquetteTemps() {
                const produits = document.querySelectorAll('.vvp-item-tile');

                produits.forEach(produit => {
                    const asin = getProductAsin(produit);
                    const storedProducts = getStoredProducts();

                    if (storedProducts.hasOwnProperty(asin)) {
                        const dateAjout = storedProducts[asin].dateAdded;
                        const texteTempsEcoule = formaterTempsEcoule(dateAjout);

                        //Sélectionner l'image dans le conteneur général
                        const image = produit.querySelector('.vvp-item-tile-content img');

                        //Créer un wrapper pour l'image
                        const wrapper = document.createElement('div');
                        wrapper.style.position = 'relative';
                        wrapper.style.display = 'inline-block';

                        //Insérer le wrapper à la place de l'image, puis y déplacer l'image
                        image.parentNode.insertBefore(wrapper, image);
                        wrapper.appendChild(image);

                        //Créer l'étiquette de temps
                        const etiquetteTemps = document.createElement('div');
                        etiquetteTemps.style.position = 'absolute';
                        if (mobileEnabled || cssEnabled) {
                            etiquetteTemps.style.top = timeVerticalMobile;
                            etiquetteTemps.style.left = timeHorizontalMobile;
                            if (isMobile()) {
                                etiquetteTemps.style.padding = '2px 3px';
                            } else {
                                etiquetteTemps.style.padding = '0px 1px';
                            }
                            etiquetteTemps.style.lineHeight = '1.2';
                        } else {
                            etiquetteTemps.style.top = timeVertical;
                            etiquetteTemps.style.left = timeHorizontal;
                            etiquetteTemps.style.padding = '1px 2px';
                        }
                        etiquetteTemps.style.transform = 'translateX(-50%)';
                        etiquetteTemps.style.backgroundColor = 'rgba(255,255,255,0.7)';
                        etiquetteTemps.style.color = 'black';
                        etiquetteTemps.style.borderRadius = '5px';
                        etiquetteTemps.style.zIndex = '5';
                        if (cssEnabled || mobileEnabled) {
                            etiquetteTemps.style.fontSize = timeFontMobile;
                        } else {
                            etiquetteTemps.style.fontSize = timeFont;
                        }
                        etiquetteTemps.style.whiteSpace = 'nowrap';
                        etiquetteTemps.textContent = texteTempsEcoule;

                        //Ajouter l'étiquette dans le wrapper de l'image
                        wrapper.appendChild(etiquetteTemps);
                    }
                });
            }

            //Variable pour savoir s'il y a eu un nouvel objet
            var imgNew = false;

            if ((autohideEnabled || extendedEnabled) && apiOk) {
                function tryAutoHideAndExtend() {
                    if (autohideEnabled) {
                        var favWordsTrim = favWords.trim();
                        var hideWordsTrim = hideWords.trim();

                        //Conversion en regex
                        var favArray = favWordsTrim.length > 0
                        ? favWordsTrim.split(',').map(pattern => {
                            pattern = pattern.trim();
                            if (pattern.length > 0) {
                                try {
                                    return new RegExp(pattern, 'i');
                                } catch (e) {
                                    console.error('Expression regex invalide :', pattern, e);
                                    return null;
                                }
                            } else {
                                return null;
                            }
                        }).filter(regex => regex != null)
                        : [];

                        var hideArray = hideWordsTrim.length > 0
                        ? hideWordsTrim.split(',').map(pattern => {
                            pattern = pattern.trim();
                            if (pattern.length > 0) {
                                try {
                                    return new RegExp(pattern, 'i');
                                } catch (e) {
                                    console.error('Expression regex invalide :', pattern, e);
                                    return null;
                                }
                            } else {
                                return null;
                            }
                        }).filter(regex => regex != null)
                        : [];
                    }

                    const itemTiles = document.querySelectorAll('.vvp-item-tile');
                    if (itemTiles.length > 0) {
                        itemTiles.forEach(function(tile) {
                            const fullTextElement = tile.querySelector('.a-truncate-full.a-offscreen');
                            const cutTextElement = tile.querySelector('.a-truncate-cut');
                            const truncateTextElement = tile.querySelector('.a-truncate');
                            const parentDiv = tile.closest('.vvp-item-tile');
                            if (!fullTextElement) return; //On vérifie que l'élément contenant le texte existe
                            const textContent = fullTextElement.textContent.trim().replace(/\s+/g, ' ');

                            //Fonction qui surligne le mot correspondant dans le texte
                            function highlightMatch(regexArray, highlightStyle) {
                                for (let regex of regexArray) {
                                    const match = textContent.match(regex);
                                    if (match) {
                                        //Remplace toutes les occurrences (insensible à la casse) par le même match enveloppé dans un span
                                        const highlightedHTML = fullTextElement.textContent.replace(new RegExp(regex.source, 'gi'), `<span style="${highlightStyle}">$&</span>`);
                                        cutTextElement.innerHTML = highlightedHTML;
                                        fullTextElement.innerHTML = highlightedHTML;
                                        break;
                                    }
                                }
                            }

                            if (extendedEnabled) {
                                if (fullTextElement && cutTextElement && fullTextElement.textContent) {
                                    if (!cssEnabled) {
                                        cutTextElement.textContent = fullTextElement.textContent;
                                        fullTextElement.innerHTML = fullTextElement.textContent;
                                        //Appliquez les styles directement pour surmonter les restrictions CSS
                                        cutTextElement.style.cssText = 'height: auto !important; max-height: none !important; overflow: visible !important; white-space: normal !important;';
                                    } else {
                                        document.addEventListener('mouseover', function(event) {
                                            const target = event.target.closest('.vvp-item-product-title-container');
                                            if (target) {
                                                const fullTextElement = target.querySelector('.a-truncate-full.a-offscreen');
                                                if (fullTextElement) {
                                                    const fullText = fullTextElement.textContent;

                                                    const popup = document.createElement('div');
                                                    popup.textContent = fullText;
                                                    popup.style.position = 'fixed';
                                                    popup.style.maxWidth = '300px';
                                                    popup.style.wordWrap = 'break-word';
                                                    if (savedTheme == "dark") {
                                                        popup.style.backgroundColor = '#fff';
                                                        popup.style.color = 'rgba(0, 0, 0, 0.8)';
                                                    } else {
                                                        popup.style.backgroundColor = 'rgb(25, 25, 25)';
                                                        popup.style.color = '#fff';
                                                    }
                                                    popup.style.padding = '5px 10px';
                                                    popup.style.borderRadius = '5px';
                                                    popup.style.zIndex = '1000';
                                                    popup.style.pointerEvents = 'none';

                                                    document.body.appendChild(popup);
                                                    const movePopup = (e) => {
                                                        popup.style.top = `${e.clientY + 10}px`;
                                                        popup.style.left = `${e.clientX + 10}px`;
                                                    };
                                                    movePopup(event);
                                                    document.addEventListener('mousemove', movePopup);

                                                    const removePopup = () => {
                                                        popup.remove();
                                                        document.removeEventListener('mousemove', movePopup);
                                                        target.removeEventListener('mouseleave', removePopup);
                                                    };
                                                    target.addEventListener('mouseleave', removePopup);
                                                }
                                            }
                                        });
                                    }
                                }
                                if (!cssEnabled) {
                                    if (fullTitleLine != '4') {
                                        let maxHeightMult = 1.4;
                                        let heightMult = 17.5;
                                        if (mobileEnabled) {
                                            maxHeightMult = 1.35;
                                            heightMult = 14.5;
                                        }
                                        const fullTitleLineInt = parseInt(fullTitleLine, 10);
                                        const maxHeight = fullTitleLineInt * maxHeightMult;
                                        const height = fullTitleLineInt * heightMult;
                                        document.querySelectorAll('.vvp-item-tile .a-truncate').forEach(function(element) {
                                            element.style.cssText = `max-height: ${maxHeight}em !important;`;
                                        });
                                        document.querySelectorAll('#vvp-items-grid .vvp-item-tile .vvp-item-tile-content > .vvp-item-product-title-container').forEach(function(element) {
                                            element.style.height = `${height}px`;
                                        });
                                    } else {
                                        document.querySelectorAll('.vvp-item-tile .a-truncate').forEach(function(element) {
                                            element.style.cssText = 'max-height: 5.6em !important;';
                                        });
                                    }
                                }
                            }
                            if (autohideEnabled) {
                                //Vérification favoris
                                if (favArray.length > 0 && favArray.some(regex => regex.test(textContent))) {
                                    parentDiv.style.backgroundColor = highlightColorFav;
                                    parentDiv.parentNode.prepend(parentDiv);
                                    parentDiv.classList.add('putproduct');
                                    if (hlFav) {
                                        highlightMatch(favArray, `background-color: ${colorHlFav};`);
                                    }
                                }
                                //Vérification pour cacher
                                else if (hideArray.length > 0 && hideArray.some(regex => regex.test(textContent))) {
                                    const asin = parentDiv.getAttribute('data-asin') || parentDiv.querySelector('.'+getStringDetailsBtnSelector()+' input').getAttribute('data-asin');
                                    const enrollment = getEnrollment(parentDiv);
                                    const hideKey = getAsinEnrollment(asin, enrollment);
                                    const etatCacheKey = hideKey + '_c';
                                    localStorage.setItem(etatCacheKey, '1');
                                    parentDiv.style.display = 'none';
                                    if (hlHide) {
                                        highlightMatch(hideArray, `background-color: ${colorHlHide};`);
                                    }
                                }
                            }
                        });
                        if (hideEnabled && autohideEnabled) {
                            ajouterIconeEtFonctionCacher();
                        }
                    }
                    //On signifie que le script a fini son action la plus "longue" pour les actions de fin
                    allFinish = true;
                }

                //On instancie le MutationObserver et on définit la fonction de callback
                const observer = new MutationObserver(mutations => {
                    //À chaque mutation, on vérifie s’il y a au moins un .vvp-item-tile
                    const itemTiles = document.querySelectorAll('.vvp-item-tile');
                    if (itemTiles.length > 0) {
                        setTimeout(tryAutoHideAndExtend, extendedDelay);
                        //Si on veut n’exécuter cette logique qu’une fois, on peut stopper l’observation :
                        observer.disconnect();
                    }
                });

                //On lance l’observation sur le document entier ou sur un conteneur spécifique
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }

            //Fonction pour parcourir et convertir les favoris de PickMe Web en localstorage
            function convertGMFav() {
                //Récupérer toutes les clés stockées avec GM_setValue
                let keys = GM_listValues();

                keys.forEach(key => {
                    //Vérifier si la clé se termine par "_f"
                    if (key.endsWith('_f')) {
                        //Récupérer la valeur correspondante
                        let value = GM_getValue(key);
                        //Stocker la valeur dans le localStorage
                        localStorage.setItem(key, value);
                        //Supprimer la valeur de GM
                        GM_deleteValue(key);
                    }
                });
            }

            function ajouterIconeEtFonctionCacher() {
                convertGMFav();
                const produits = document.querySelectorAll('.vvp-item-tile');
                const resultats = document.querySelector('#vvp-items-grid-container > p');
                const vineGrid = document.querySelector('#vvp-items-grid');

                //Ajout du style pour les boutons
                const style = document.createElement('style');
                style.textContent = `
		.bouton-reset {
			background-color: #f7ca00;
			color: black;
			font-weight: bold;
			text-decoration: none;
			display: inline-block;
			border: 1px solid #dcdcdc;
			border-radius: 20px;
			padding: 3px 10px;
			margin-left: 5px;
			cursor: pointer;
			outline: none;
		}

    `;

                style.textContent += `
		 .bouton-action {
			background-color: #f7ca00;
			color: black;
			font-weight: bold;
			text-decoration: none;
			display: inline-block;
			border: 1px solid #dcdcdc;
			border-radius: 20px;
			padding: 5px 15px;
			margin-right: 5px;
			cursor: pointer;
			outline: none;
		}
		`;
                document.head.appendChild(style);

                //Icone pour cacher/montrer
                const urlIcone = hideUrlOff;
                const urlIconeOeil = hideUrlOn;
                //Création des boutons avec le nouveau style
                function creerBoutons(position) {
                    //Bouton pour les produits visibles
                    const boutonVisibles = document.createElement('button');
                    boutonVisibles.textContent = produitsVisibles;
                    boutonVisibles.classList.add('bouton-filtre', 'active');
                    boutonVisibles.id = `boutonVisibles${position}`;

                    //Bouton pour les produits cachés
                    const boutonCaches = document.createElement('button');
                    boutonCaches.textContent = produitsCaches;
                    boutonCaches.classList.add('bouton-filtre');
                    boutonCaches.id = `boutonCaches${position}`;

                    //Bouton pour cacher tout
                    const boutonCacherTout = document.createElement('button');
                    boutonCacherTout.textContent = toutCacher;
                    boutonCacherTout.classList.add('bouton-action');
                    boutonCacherTout.id = `boutonCacherTout${position}`;

                    //Bouton pour tout afficher
                    const boutonToutAfficher = document.createElement('button');
                    boutonToutAfficher.textContent = toutAfficher;
                    boutonToutAfficher.classList.add('bouton-action');
                    boutonToutAfficher.id = `boutonToutAfficher${position}`;

                    return { boutonVisibles, boutonCaches, boutonCacherTout, boutonToutAfficher };
                }

                //Fonction pour synchroniser les boutons haut et bas
                function synchroniserBoutons(boutonsHaut, boutonsBas, hideBas) {
                    //Synchronisation du bouton "Produits visibles"
                    boutonsHaut.boutonVisibles.addEventListener('click', () => {
                        afficherProduits(true);
                        boutonsHaut.boutonVisibles.classList.add('active');
                        boutonsHaut.boutonCaches.classList.remove('active');

                        if (hideBas) {
                            boutonsBas.boutonVisibles.classList.add('active');
                            boutonsBas.boutonCaches.classList.remove('active');
                        }
                    });

                    if (hideBas) {
                        boutonsBas.boutonVisibles.addEventListener('click', () => {
                            afficherProduits(true);
                            boutonsHaut.boutonVisibles.classList.add('active');
                            boutonsHaut.boutonCaches.classList.remove('active');
                        });
                    }

                    //Synchronisation du bouton "Produits cachés"
                    boutonsHaut.boutonCaches.addEventListener('click', () => {
                        afficherProduits(false);
                        boutonsHaut.boutonVisibles.classList.remove('active');
                        boutonsHaut.boutonCaches.classList.add('active');

                        if (hideBas) {
                            boutonsBas.boutonVisibles.classList.remove('active');
                            boutonsBas.boutonCaches.classList.add('active');
                        }
                    });

                    if (hideBas) {
                        boutonsBas.boutonCaches.addEventListener('click', () => {
                            afficherProduits(false);
                            boutonsHaut.boutonVisibles.classList.remove('active');
                            boutonsHaut.boutonCaches.classList.add('active');
                        });
                    }

                    //Synchronisation des boutons "Tout cacher" et "Tout afficher"
                    boutonsHaut.boutonCacherTout.addEventListener('click', () => {
                        toggleTousLesProduits(true);
                        boutonsHaut.boutonCacherTout.style.display = '';
                        boutonsHaut.boutonToutAfficher.style.display = 'none';

                        if (hideBas) {
                            boutonsBas.boutonCacherTout.style.display = '';
                            boutonsBas.boutonToutAfficher.style.display = 'none';
                        }
                    });

                    if (hideBas) {
                        boutonsBas.boutonCacherTout.addEventListener('click', () => {
                            toggleTousLesProduits(true);
                            boutonsHaut.boutonCacherTout.style.display = '';
                            boutonsHaut.boutonToutAfficher.style.display = 'none';
                        });
                    }

                    boutonsHaut.boutonToutAfficher.addEventListener('click', () => {
                        toggleTousLesProduits(false);
                        boutonsHaut.boutonCacherTout.style.display = 'none';
                        boutonsHaut.boutonToutAfficher.style.display = '';

                        if (hideBas) {
                            boutonsBas.boutonCacherTout.style.display = 'none';
                            boutonsBas.boutonToutAfficher.style.display = '';
                        }
                    });

                    if (hideBas) {
                        boutonsBas.boutonToutAfficher.addEventListener('click', () => {
                            toggleTousLesProduits(false);
                            boutonsHaut.boutonCacherTout.style.display = 'none';
                            boutonsHaut.boutonToutAfficher.style.display = '';
                        });
                    }
                }

                //Création et insertion des boutons en haut et en bas
                const boutonsHaut = creerBoutons('Haut');
                const divBoutonsHaut = document.createElement('div');
                divBoutonsHaut.id = "divCacherHaut";
                divBoutonsHaut.style.marginTop = '5px'; //Réduit l'espace au-dessus des boutons
                divBoutonsHaut.style.marginBottom = '15px'; //Augmente l'espace en dessous des boutons
                divBoutonsHaut.appendChild(boutonsHaut.boutonVisibles);
                divBoutonsHaut.appendChild(boutonsHaut.boutonCaches);
                divBoutonsHaut.appendChild(boutonsHaut.boutonCacherTout);
                divBoutonsHaut.appendChild(boutonsHaut.boutonToutAfficher);

                if (resultats) {
                    resultats.after(divBoutonsHaut);
                } else if (vineGrid) {
                    vineGrid.before(divBoutonsHaut);
                }

                const boutonsBas = creerBoutons('Bas');
                const divBoutonsBas = document.createElement('div');
                if (cssEnabled) {
                    divBoutonsBas.style.marginTop = '15px';
                } else {
                    divBoutonsBas.style.marginTop = '5px'; //Réduit l'espace au-dessus des boutons
                }
                divBoutonsBas.style.marginBottom = '15px'; //Augmente l'espace en dessous des boutons
                divBoutonsBas.appendChild(boutonsBas.boutonVisibles);
                divBoutonsBas.appendChild(boutonsBas.boutonCaches);
                divBoutonsBas.appendChild(boutonsBas.boutonCacherTout);
                divBoutonsBas.appendChild(boutonsBas.boutonToutAfficher);

                if (vineGrid && hideBas) {
                    vineGrid.after(divBoutonsBas);
                }

                //Synchronisation des boutons haut et bas
                synchroniserBoutons(boutonsHaut, boutonsBas, hideBas);

                //Fonction pour cacher ou afficher tous les produits
                function toggleTousLesProduits(cacher) {
                    produits.forEach(produit => {
                        const asin = getProductAsin(produit);
                        const enrollment = getEnrollment(produit);
                        const hideKey = getAsinEnrollment(asin, enrollment);
                        const etatCacheKey = hideKey + '_c';
                        const etatFavoriKey = asin + '_f';

                        //Vérifie si le produit est en favori avant de changer son état de caché
                        const etatFavori = localStorage.getItem(etatFavoriKey) || '0';
                        if (etatFavori == '0') { //Ne modifie l'état de caché que si le produit n'est pas en favori
                            localStorage.setItem(etatCacheKey, cacher ? '1' : '0');

                            //Sélection de l'icône d'œil dans le produit actuel et mise à jour si l'état de caché change
                            const iconeOeil = produit.querySelector('img[src="' + urlIcone + '"], img[src="' + urlIconeOeil + '"]');
                            if (iconeOeil) {
                                iconeOeil.setAttribute('src', cacher ? urlIconeOeil : urlIcone);
                            }
                        }
                    });

                    //Force la mise à jour de l'affichage selon le nouveau statut de visibilité
                    afficherProduits(cacher);
                }

                //Affiche les produits en fonction du filtre : visible ou caché
                function afficherProduits(afficherVisibles) {
                    const produitsFavoris = [];
                    produits.forEach(produit => {
                        const asin = getProductAsin(produit);
                        const enrollment = getEnrollment(produit);
                        const hideKey = getAsinEnrollment(asin, enrollment);
                        const etatCacheKey = hideKey + '_c';
                        const etatFavoriKey = asin + '_f';

                        //Convertir de la key ASIN à la key ASIN + enrollment, à partir de la 1.14 ou après une synchro
                        const etatCacheOldKey = asin + '_c';
                        const oldValue = localStorage.getItem(etatCacheOldKey);
                        if (oldValue !== null) {
                            localStorage.setItem(etatCacheKey, oldValue);
                            localStorage.removeItem(etatCacheOldKey);
                        }
                        //Fin de conversion

                        //Initialisation des états si non définis
                        let etatCache = localStorage.getItem(etatCacheKey) || '0';
                        let etatFavori = localStorage.getItem(etatFavoriKey) || '0';

                        //Enregistre les valeurs par défaut si nécessaire
                        if (localStorage.getItem(etatCacheKey) === null) {
                            localStorage.setItem(etatCacheKey, etatCache);
                        }
                        if (localStorage.getItem(etatFavoriKey) === null) {
                            localStorage.setItem(etatFavoriKey, etatFavori);
                        }
                        //On test s'il est favori et si on peut le cacher ou non
                        if (etatFavori == '1') {
                            //Les produits favoris sont toujours affichés dans l'onglet "Produits visibles"
                            //et cachés dans l'onglet "Produits cachés"
                            produit.style.display = afficherVisibles ? '' : 'none';
                            produitsFavoris.push(produit);
                        } else {
                            if ((etatCache == '0' && afficherVisibles) || (etatCache == '1' && !afficherVisibles)) {
                                produit.style.display = '';
                            } else {
                                produit.style.display = 'none';
                            }
                        }
                    });
                    const containerDiv = document.getElementById('vvp-items-grid'); //L'élément conteneur de tous les produits
                    if (containerDiv) {
                        produitsFavoris.reverse().forEach(element => {
                            containerDiv.prepend(element);
                            element.classList.add('favproduct');
                        });
                    }
                    boutonsHaut.boutonVisibles.classList.toggle('active', afficherVisibles); //Active ou désactive le bouton des produits visibles
                    boutonsBas.boutonVisibles.classList.toggle('active', afficherVisibles);
                    boutonsHaut.boutonCaches.classList.toggle('active', !afficherVisibles); //Active ou désactive le bouton des produits cachés
                    boutonsBas.boutonCaches.classList.toggle('active', !afficherVisibles);
                    //Gestion de l'affichage des boutons "Cacher tout" et "Tout afficher"
                    boutonsHaut.boutonCacherTout.style.display = afficherVisibles ? '' : 'none';
                    boutonsBas.boutonCacherTout.style.display = afficherVisibles ? '' : 'none';
                    boutonsHaut.boutonToutAfficher.style.display = !afficherVisibles ? '' : 'none';
                    boutonsBas.boutonToutAfficher.style.display = !afficherVisibles ? '' : 'none';
                    if (customSortingEnabled) {
                        sortItems(customSorting);
                    }
                }

                produits.forEach(produit => {
                    const image = produit.querySelector('.vvp-item-tile-content img');
                    const asin = getProductAsin(produit);
                    const enrollment = getEnrollment(produit);
                    const hideKey = getAsinEnrollment(asin, enrollment);
                    const etatCacheKey = hideKey + '_c';
                    const etatFavoriKey = asin + '_f';
                    const iconeOeil = document.createElement('img');

                    let wrapper = image.parentNode;
                    if (!wrapper.classList.contains('image-wrapper')) {
                        const newWrapper = document.createElement('div');
                        newWrapper.classList.add('image-wrapper');
                        newWrapper.style.position = 'relative';
                        newWrapper.style.display = 'inline-block';
                        //Insertion du nouveau wrapper à la place de l'image, puis déplacement de l'image dedans
                        wrapper.insertBefore(newWrapper, image);
                        newWrapper.appendChild(image);
                        wrapper = newWrapper;
                    }
                    const etatCache = localStorage.getItem(etatCacheKey) || '0';
                    iconeOeil.setAttribute('src', etatCache === '1' ? urlIconeOeil : urlIcone);
                    if (cssEnabled || mobileEnabled) {
                        iconeOeil.style.cssText = `
                  position: absolute;
                  top: ${hideVerticalMobile};
                  right: ${hideHorizontalMobile};
                  cursor: pointer;
                  width: ${hideSizeWidthMobile};
                  height: ${hideSizeHeightMobile};
                  z-index: 10;
                `;
                    } else {
                        iconeOeil.style.cssText = `
                  position: absolute;
                  top: ${hideVertical};
                  right: ${hideHorizontal};
                  cursor: pointer;
                  width: ${hideSizeWidth};
                  height: ${hideSizeHeight};
                  z-index: 10;
                `;
                    }

                    iconeOeil.addEventListener('click', () => {
                        const etatFavoriKey = asin + '_f';
                        const etatFavori = localStorage.getItem(etatFavoriKey) || '0';

                        //Vérifie si le produit n'est pas marqué comme favori avant de changer son état de caché
                        if (etatFavori === '0') {
                            const etatCacheActuel = localStorage.getItem(etatCacheKey);
                            const nouvelEtatCache = etatCacheActuel === '1' ? '0' : '1';
                            localStorage.setItem(etatCacheKey, nouvelEtatCache);

                            //Met à jour l'icône basée sur le nouvel état après le clic
                            iconeOeil.setAttribute('src', etatCacheActuel === '1' ? urlIcone : urlIconeOeil);
                        }

                        //Force la mise à jour de l'affichage selon l'état actuel des filtres
                        afficherProduits(!boutonsHaut.boutonCaches.classList.contains('active'));
                    });

                    const urlIconeFavoriGris = favUrlOff;
                    const urlIconeFavoriRouge = favUrlOn;
                    const iconeFavori = document.createElement('img');

                    const etatFavori = localStorage.getItem(etatFavoriKey);
                    iconeFavori.setAttribute('src', (etatFavori && etatFavori == '1') ? urlIconeFavoriRouge : urlIconeFavoriGris);
                    if (cssEnabled || mobileEnabled) {
                        iconeFavori.style.cssText = `
                  position: absolute;
                  top: ${favVerticalMobile};
                  left: ${favHorizontalMobile};
                  cursor: pointer;
                  width: ${favSizeMobile};
                  height: ${favSizeMobile};
                  z-index: 10;
                `;
                    } else {
                        iconeFavori.style.cssText = `
                  position: absolute;
                  top: ${favVertical};
                  left: ${favHorizontal};
                  cursor: pointer;
                  width: ${favSize};
                  height: ${favSize};
                  z-index: 10;
                `;
                    }

                    //Gestion du clic sur l'icône de favori
                    iconeFavori.addEventListener('click', () => {
                        var etatFavoriActuel = localStorage.getItem(etatFavoriKey) || '0';
                        etatFavoriActuel = etatFavoriActuel === '1' ? '0' : '1';
                        localStorage.setItem(etatFavoriKey, etatFavoriActuel);
                        iconeFavori.setAttribute('src', etatFavoriActuel === '1' ? urlIconeFavoriRouge : urlIconeFavoriGris);
                        produit.classList.toggle('favproduct');

                        if (etatFavoriActuel === '1') {
                            //Si le produit est marqué comme favori, s'assurer qu'il est marqué comme non caché
                            localStorage.setItem(etatCacheKey, '0');
                            produit.style.display = ''; //Assure que le produit est visible
                            //Mettre à jour l'icône de l'œil pour refléter que le produit n'est plus caché
                            const iconeOeil = produit.querySelector('img[src="' + urlIcone + '"], img[src="' + urlIconeOeil + '"]');
                            if (iconeOeil) {
                                iconeOeil.setAttribute('src', urlIcone);
                            }
                        }

                        afficherProduits(!boutonsHaut.boutonCaches.classList.contains('active'));
                    });

                    wrapper.appendChild(iconeOeil);
                    wrapper.appendChild(iconeFavori);
                });

                //Initialisation de l'affichage par défaut à 'Produits Visibles'
                afficherProduits(true);
            }

            if (hideEnabled && apiOk && !autohideEnabled) {
                //Appeler la fonction pour ajouter les étiquettes de temps
                ajouterIconeEtFonctionCacher();
            }
            //Exécuter la fonction pour ajouter les icônes et les fonctionnalités de cacher
            if (highlightEnabled && apiOk) {
                //Appeler la fonction pour ajouter les étiquettes de temps
                ajouterEtiquetteTemps();
            }

            //Suppression footer
            var styleFooter = document.createElement('style');

            styleFooter.textContent = `
            #rhf, #rhf-shoveler, .rhf-frame, #navFooter {
              display: none !important;
            }
            footer.nav-mobile.nav-ftr-batmobile {
              display: none !important;
            }
         `
            document.head.appendChild(styleFooter);

            //Nombre de colonnes fixe
            if (apiOk && columnEnabled) {
                const style = document.createElement('style');
                style.innerHTML = `
            #vvp-items-grid {
                display: grid !important;
                grid-template-columns: repeat(${nbColumn}, 1fr) !important;
            }
        `;
                document.head.appendChild(style);
            }

            //Agrandir la fenetre des adresses
            if (fastCmdEnabled && apiOk) {
                var styleAddress = document.createElement('style');

                styleAddress.textContent = `
            #a-popover-4 {
                height: 480px !important;
                width: 900px !important;
            }
            `
                document.head.appendChild(styleAddress);
            }


            //Pour monter la valeur de la taxe
            if (taxValue && apiOk) {
                //Créez une balise <style>
                var style = document.createElement('style');
                if (isMobile()) {
                    style.textContent = `
        #product-details-sheet-tax-value {
			position: absolute !important;
			top: 0px !important;
            width: auto;
			z-index: 101;
		}
        .a-sheet-heading-container {
            position: relative;
        }
		`;
                } else {
                    style.textContent = `
		#vvp-product-details-modal--tax-value {
			position: absolute !important;
			top: 20px !important;
			z-index: 101;
			left: 18px;
		}
		`;
                }
                //Ajout du style à la page
                document.head.appendChild(style);
                //Remonter les variantes dans les détails
                if (mobileEnabled) {
                    var variationsContainer = document.getElementById('vvp-product-details-modal--variations-container');
                    var descriptionExpander = document.getElementById('vvp-product-description-expander');

                    //Vérification que les deux éléments existent
                    if (variationsContainer && descriptionExpander) {
                        //Déplacer variationsContainer avant descriptionExpander
                        descriptionExpander.parentNode.insertBefore(variationsContainer, descriptionExpander);
                    }
                }
            }

            //Affichage alternatif
            if (cssEnabled && apiOk)
            {
                var styleCss = document.createElement('style');

                styleCss.textContent = `
//Catégories
#vvp-browse-nodes-container .parent-node {
  background-color: transparent;
}
#vvp-browse-nodes-container > div:nth-child(odd) {
    background-color: rgb(127 127 127 / 10%) !important;
}
#vvp-browse-nodes-container .parent-node, #vvp-browse-nodes-container .child-node  {
  display: flex !important;
}
#vvp-browse-nodes-container .parent-node a, #vvp-browse-nodes-container .child-node a {
  flex-grow: 1 !important;
}

//Items
.a-container.vvp-body {
  padding: 0px;
  max-width: unset !important;
  min-width: unset !important;
}

#vvp-header ~ .a-section {
  display: none;
}

.vvp-body > * + * {
  margin-top: 0px !important;
}

.vvp-header-links-container {
  margin-right: 0.5rem;
}

#vvp-items-grid-container .vvp-item-tile .vvp-item-tile-content {
  width: var(--grid-column-width, 110px) !important;
}

#vvp-items-grid-container .vvp-item-tile .vvp-item-tile-content > * {
  margin: 0 !important;
}

#vvp-items-grid-container .vvp-item-tile .vvp-item-tile-content > img {
  margin-top: 0.5rem !important;
}

.vvp-item-tile,
.a-tab-content {
  border: none !important;
}

#vvp-items-grid
  .vvp-item-tile
  .vvp-item-tile-content
  > .vvp-item-product-title-container {
  height: var(--item-tile-height, 40px) !important;
}

/*  Button */
#vvp-beta-tag {
  display: none;
}

#vvp-search-button,
#vvp-search-text-input {
  border-radius: 0rem !important;
}

#vvp-search-button #vvp-search-button-announce {
  line-height: 1 !important;
}

#vvp-search-button .a-button-inner {
  display: flex;
  align-items: center;
}
`;
                //On adapte la règle suivant si on a fixer les colonnes ou pas
                if (!columnEnabled) {
                    styleCss.textContent += `
#vvp-items-grid, #tab-unavailable, #tab-hidden, #tab-favourite {
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--grid-column-width, 110px), auto)
  ) !important;
  margin-bottom: 0px !important;
}
`;
                } else {
                    styleCss.textContent += `
#tab-unavailable, #tab-hidden, #tab-favourite {
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--grid-column-width, 110px), auto)
  ) !important;
  margin-bottom: 0px !important;
}
`;
                }
                document.head.appendChild(styleCss);
            }

            //Affichage mobile
            if (mobileEnabled && apiOk)
            {
                //Pour ajouter une classe sur "Catégorie" et gérer l'ouverture/fermeture
                function initToggle() {
                    const container = document.getElementById('vvp-browse-nodes-container');
                    if (!container) return;

                    //Créer ou cibler le contenu repliable
                    let content = container.querySelector('.vvp-browse-nodes-content');
                    if (!content) {
                        content = document.createElement('div');
                        content.className = 'vvp-browse-nodes-content';

                        //Déplacer tous les enfants sauf le header dedans
                        const children = Array.from(container.children).filter(child => child.id !== 'vvp-toggle-header');
                        children.forEach(child => content.appendChild(child));

                        container.appendChild(content);
                    }

                    //Ajouter le bandeau cliquable
                    let header = container.querySelector('#vvp-toggle-header');
                    if (!header) {
                        header = document.createElement('div');
                        header.id = 'vvp-toggle-header';
                        header.textContent = 'Catégories';
                        container.prepend(header);
                    }

                    //État initial : fermé
                    container.classList.add('closed');

                    header.addEventListener('click', function (e) {
                        container.classList.toggle('closed');
                        e.stopPropagation();
                    });
                }


                function waitForContainer() {
                    const container = document.getElementById('vvp-browse-nodes-container');
                    if (container) {
                        initToggle();
                    } else {
                        //Réessaie jusqu'à ce que le DOM soit prêt
                        setTimeout(waitForContainer, 100);
                    }
                }

                waitForContainer();

                var mobileCss = document.createElement('style');
                //On calcule si on doit appliquer la hauteur ou non
                var applyHeight = !(extendedEnabled && mobileEnabled);

                mobileCss.textContent = `
#product-details-sheet-footer {
    position: sticky;
    bottom: 0;
    padding: 1rem;
    z-index: 10;
}

/*Pour gérer Avis/Commandes/Compte*/
#vvp-header {
  display: flex !important;
  align-items: center; !important;
  justify-content: flex-start !important;
  font-weight: bold !important;
}

#vvp-header a.a-link-normal {
  position: relative;
  padding: 0 0.15em;
  text-decoration: none;
}

/*Centrer le bouton des catégories*/
#categories-sheet {
    margin-right: 8px !important;
    margin-left: -8px !important;
}

.vvp-items-button-scroll-container {
    overflow: visible !important;
}

#vvp-header a.a-link-normal:last-of-type::after {
  content: "";
}

#configPopup {
  width: 400px !important;
  height: 600px;
}

#colorPickerPopup, #keyConfigPopup, #favConfigPopup, #notifConfigPopup, #notePopup, #advancedConfigPopup {
  width: 400px !important;
}

/*#colorPickerPopup {
  width: 400px !important;
  height: 250px !important;
}

#notifConfigPopup {
  width: 400px !important;
  height: 350px !important;
}

#favConfigPopup, #notePopup {
  width: 400px !important;
  height: 550px !important;
}*/

/* Taille dynamique pour mobile */
@media (max-width: 600px) {
  #configPopup, #advancedConfigPopup {
    width: 90%; /* Prendre 90% de la largeur de l'écran */
    height: 90%;
    margin: 10px auto; /* Ajout d'un peu de marge autour des popups */
  }
}

@media (max-width: 600px) {
  #colorPickerPopup, #keyConfigPopup, #favConfigPopup, #notifConfigPopup, #notePopup {
    width: 90%; /* Prendre 90% de la largeur de l'écran */
    margin: 10px auto; /* Ajout d'un peu de marge autour des popups */
  }
}

:root {
  /*defaults--mostly for dev reference*/
  --default-item-tile-height: 30px;
  --default-grid-column: 90px;
  --default-max-product-title: 100px;
  --default-product-title-text-size: 10px;
  --default-cutoff-background-color: #d1d1d1;

  /*users can define custom  overrides by defining
  --custom-orgin-param-name

  /*item-title-height is the base value for derived items*/
  --item-tile-height: var(
    --custom-item-tile-height,
    var(--default-item-tile-height)
  );

  --calc-grid-column-width: calc(var(--item-tile-height) * 2.75);
  --grid-column-width: var(
    --custom-item-grid-column-width,
    var(--calc-grid-column-width)
  );

  --calc-max-product-title: calc(var(--item-tile-height) * 1.25);
  --max-product-title: var(
    --custom-max-product-title,
    var(--calc-max-product-title)
  );

  --calc-product-title-text-size: calc(var(--item-tile-height) * 0.333);
  --product-title-text-size: var(
    --custom-product-title-text-size,
    var(--calc-product-title-text-size)
  );

  /*used in cutoff.css file, defined here for convenience*/
  --cutoff-background-color: var(
    --custom-cutoff-background-color,
    var(--default-cutoff-background-color)
  );
}

body {
  padding-right: 0px !important;
}

/*Fix gap des colonnes mise a jour Amazon 08/05/25 */
#vvp-items-grid {
    column-gap: 0px !important;
}

.a-section.vvp-items-button-and-search-container {
  flex-direction: column !important;
}

.vvp-container-right-align {
  margin-top: 10px !important;
  width: 100% !important;
  flex-grow: 1 !important;
}

.a-icon-search {
  display: none;
}

.a-search {
  flex-grow: 1;
}

#vvp-search-text-input {
  width: 100% !important;
}

.a-tabs {
  margin: 0px !important;
}

.a-tabs li a {
  padding: 1rem !important;
}

.nav-mobile.nav-ftr-batmobile {
  display: none;
}

.vvp-tab-set-container
  [data-a-name="vine-items"]
  .a-box-inner
  .vvp-tab-content
  .vvp-items-button-and-search-container {
  margin: 0px !important;
}

#a-page
  > div.a-container.vvp-body
  > div.a-tab-container.vvp-tab-set-container
  > ul {
  margin-bottom: 0px !important;
}

#vvp-header {
  justify-content: center !important;
}

.vvp-body {
  padding: 0px !important;
}

.vvp-header-links-container a,
.a-tab-heading a {
  font-size: 12px !important;
}

#vvp-items-button-container {
  width: 100% !important;
}

#vvp-browse-nodes-container .child-node {
  margin-left: 20px !important;
}

/* STRIPPED CATEGORIES */
#vvp-browse-nodes-container .parent-node {
  background-color: white;
}
#vvp-browse-nodes-container > div:nth-child(odd) {
  background-color: #f3f3f3 !important;
}

#vvp-browse-nodes-container .parent-node,
#vvp-browse-nodes-container .child-node {
  display: flex !important;
}
#vvp-browse-nodes-container .parent-node a,
#vvp-browse-nodes-container .child-node a {
  flex-grow: 1 !important;
}

#vvp-browse-nodes-container > p {
  margin-top: 50px;
  text-align: right;
}

#vvp-browse-nodes-container {
  position: relative;
  border: 1px solid #333;
  margin-bottom: 1rem;
  margin-top: 1rem;
}

#vvp-toggle-header {
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-weight: bold;
  user-select: none;
}

#vvp-browse-nodes-container.closed .vvp-browse-nodes-content {
    display: none;
}

#vvp-browse-nodes-container.closed p,
#vvp-browse-nodes-container.closed .parent-node,
#vvp-browse-nodes-container.closed .child-node,
#vvp-browse-nodes-container.closed #info-container {
  display: none !important;
}

#vvp-items-button-container .a-button-toggle.a-button {
  margin: 0px !important;
  padding: 0px !important;
  width: calc(100% / 3) !important;
  border-radius: 0px;
}

#vvp-items-button-container .a-button-toggle.a-button a {
  font-size: 12px !important;
  height: ${sizeMobileCat};
  display: flex;
  align-items: center;
  padding: 0 !important;
  justify-content: center !important;
}

.vvp-items-container {
  flex-direction: column !important;
}

#vvp-items-grid .vvp-item-tile .vvp-item-tile-content > * {
  margin: 0 !important;
}

#vvp-items-grid .vvp-item-tile .vvp-item-tile-content > img {
  margin-top: 0.5rem !important;
}

.vvp-item-tile,
.a-tab-content {
  border: none !important;
}

.a-button-primary {
  transition: 0.2s !important;
}

.a-button-primary .a-button-inner {
  background-color: transparent !important;
}

.a-button-primary:hover {
  opacity: 0.85 !important;
}

/* Pagination styles */
.a-pagination {
  display: flex !important;
  justify-content: center;
}

.a-pagination li:first-child,
.a-pagination li:last-child {
  color: transparent !important;
  position: relative;
}

.a-pagination li.a-disabled {
  display: none !important;
}

.a-pagination li:first-child a,
.a-pagination li:last-child a {
  display: flex;
  align-content: center;
  position: relative;
  justify-content: center;
}

.a-pagination li:first-child a:before,
.a-pagination li:last-child a:before {
  position: absolute !important;
  color: white !important;
  font-size: 2rem !important;
  line-height: 4rem;
  height: 100%;
  width: 100%;
}

ul.a-pagination li:first-child a,  /* Cible le premier li de la liste, supposant que c'est Précédent */
li:last-child.a-last a {     /* Cible les li avec classe 'a-last', supposant que c'est Suivant */
    font-size: 0;
}

li:first-child a span.larr,  /* Cible le span larr dans le premier li */
li.a-last a span.larr {      /* Cible le span larr dans les li a-last */
    font-size: 16px;
    visibility: visible;
}

.a-pagination li {
  width: 40px !important;
  height: 40px !important;
}
.a-pagination li a {
  padding: 0px !important;
  margin: 0px !important;
  height: 100%;
  line-height: 40px !important;
}

.vvp-details-btn, .vvp-details-btn-mobile {
  padding: 0.25rem 0 !important;
  margin: 0.25rem 0rem !important;
}

.vvp-details-btn .a-button-text, .vvp-details-btn-mobile .a-button-text {
  padding: 0.5px 0.25px !important;
}

/* Pour rabaisser le logo en mobile */
#vvp-logo-link img {
    margin-top: 10px;
}

/* RFY, AFA, AI */
#vvp-items-button--recommended a,
#vvp-items-button--all a,
#vvp-items-button--seller a,
#vvp-all-items-button a {
  color: transparent;
}

#vvp-items-button--recommended a::before,
#vvp-items-button--all a::before,
#vvp-items-button--seller a::before,
#vvp-all-items-button a::before {
  color: black !important;
  position: absolute;
  font-size: 20px;
  font-weight: bold;
}

#vvp-items-button--recommended a::before { content: "RFY"; }
#vvp-items-button--all         a::before { content: "AFA"; }
#vvp-items-button--seller      a::before { content: "AI";  }
#vvp-all-items-button          a::before { content: "ALL"; }

/* Pour éviter le retour a la ligne des catégories */
#vvp-items-button-container {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    width: 100%;
}

#vvp-items-button-container .a-button-toggle.a-button {
    flex: 1 1 0;
    min-width: 100px;
    text-align: center;
}

/* PRODUCT MODAL */
.vvp-modal-footer #vvp-product-details-modal--back-btn,
.vvp-modal-footer .a-button-discord,
.vvp-modal-footer #vvp-product-details-modal--request-btn {
    margin-bottom: 10px;
}

.a-popover.a-popover-modal.a-declarative.a-popover-modal-fixed-height {
  height: calc(100% - 100px) !important;
  width: 100% !important;
  top: 50px !important;
  right: 0px !important;
  left: 0px !important;
  padding: 0px !important;
}

#vvp-product-details-modal--main {
  flex-direction: column;
}

#vvp-product-details-modal--tax-value {
  position: absolute !important;
  top: 20px !important;
  z-index: 100;
  left: 18px;
}

#vvp-product-details-img-container {
  width: unset !important;
  height: 150px !important;
  display: flex !important;
  justify-content: center !important;
  position: relative !important;
}

#vvp-product-details-img-container img {
  height: 150px !important;
}

/* GHOST ICON */
#vvp-product-details-modal--limited-quantity {
  position: absolute !important;
  bottom: -28px !important;
  z-index: 101 !important;
  right: 8px !important;
  color: transparent !important;
  width: 41.2px !important;
}

#vvp-product-details-modal--limited-quantity::before {
  content: ${iconLimited};
  font-size: 30px;
  text-shadow: 0px 0px 20px #ff0000 !important;
  color: white !important;
}

/* SEARCH BUTTON */
#vvp-beta-tag {
  display: none;
}

#vvp-search-button,
#vvp-search-text-input {
  border-radius: 0rem !important;
}

#vvp-search-button #vvp-search-button-announce {
  line-height: 1 !important;
}

/* COLLAPSABLE CATEGORIES */
.vvp-items-container {
  margin: 0rem !important;
}

/* PRODUCT AND REVIEW PAGES */
#vvp-product-details-img-container,
#vvp-product-details-img-container img {
  height: 75px;
}

#vvp-browse-nodes-container,
#vvp-browse-nodes-container .parent-node,
#vvp-browse-nodes-container .child-node {
  width: unset !important;
}

.vvp-reviews-table .vvp-reviews-table--row,
.vvp-orders-table .vvp-orders-table--row {
  display: flex;
  flex-wrap: wrap;
}

.vvp-reviews-table tbody,
.vvp-orders-table tbody {
  display: flex !important;
  flex-wrap: wrap;
}

.vvp-reviews-table--heading-row,
.vvp-orders-table--heading-row {
  display: none !important;
}

.vvp-reviews-table td,
.vvp-orders-table td {
  padding-top: 0px !important;
  padding-bottom: 0px !important;
}

.vvp-reviews-table td.vvp-reviews-table--image-col,
.vvp-orders-table td.vvp-orders-table--image-col {
  padding-top: 10px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.vvp-reviews-table td.vvp-reviews-table--image-col img,
.vvp-orders-table td.vvp-orders-table--image-col img {
  height: 75px;
}

.vvp-reviews-table--actions-col,
.vvp-orders-table--actions-col {
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
}

#vvp-items-grid-container .vvp-item-tile .vvp-item-tile-content {
  width: var(--grid-column-width) !important;
}

#vvp-items-grid-container
  .vvp-item-tile
  .vvp-item-tile-content
  > .vvp-item-product-title-container {
  ${applyHeight ? 'height: var(--max-product-title) !important;' : ''}
  font-size: var(--product-title-text-size) !important;
}

#vvp-items-grid-container
  .vvp-item-tile
  .vvp-item-tile-content
  > .vvp-item-product-title-container
  .a-truncate {
  max-height: var(--max-product-title) !important;
}

#vvp-header .vvp-header-links-container {
  display: block !important;
}
`;
                //On adapte la règle suivant si on a fixer les colonnes ou pas
                if (!columnEnabled) {
                    mobileCss.textContent += `
#vvp-items-grid, #tab-unavailable, #tab-hidden, #tab-favourite {
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--grid-column-width), auto)
  ) !important;
}
`;
                } else {
                    mobileCss.textContent += `
#tab-unavailable, #tab-hidden, #tab-favourite {
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--grid-column-width), auto)
  ) !important;
}
`;
                }
                document.head.appendChild(mobileCss);
            }

            //Affichage mobile pour ceux qui on pas RR
            if (mobileEnabled) {
                const apiOkRR = GM_getValue("apiToken", false);
                //On test la clé API car désactivé (variable non défini) sur les pages de RR sinon
                if (apiOkRR) {

                    const remplacements = {
                        "Voir la commande": "Commande",
                        "Donner un avis": "Avis",
                        "Voir le commentaire": "Commentaire"
                    };

                    const remplacerTextes = () => {
                        document.querySelectorAll('a.a-button-text').forEach(link => {
                            const texte = link.textContent.trim();
                            if (remplacements[texte]) {
                                link.textContent = remplacements[texte];
                            }
                        });
                    };

                    //Exécution immédiate pour les éléments déjà présents
                    remplacerTextes();

                    //Observation dynamique du DOM
                    const observer = new MutationObserver(() => remplacerTextes());
                    observer.observe(document.body, { childList: true, subtree: true });

                    if (headerEnabled) {
                        var styleHeaderRR = document.createElement('style');

                        styleHeaderRR.textContent = `
body {
  padding-right: 0px !important;
}

#navbar-main, #nav-main, #skiplink {
  display: none;
}

.amzn-ss-wrap {
  display: none !important;
}
`
                        document.head.appendChild(styleHeaderRR);
                    }
                    var mobileCssRR = document.createElement('style');

                    mobileCssRR.textContent = `
#configPopupRR, #emailConfigPopup {
  width: 350px !important;
  height: 600px;
}

#colorPickerPopup {
  width: 350px !important;
}

/* Taille dynamique pour mobile */
@media (max-width: 600px) {
  #configPopupRR {
    width: 90%; /* Prendre 90% de la largeur de l'écran */
    height: 90%;
    margin: 10px auto; /* Ajout d'un peu de marge autour des popups */
  }
}

@media (max-width: 600px) {
  #colorPickerPopup, #emailConfigPopup {
    width: 90%; /* Prendre 90% de la largeur de l'écran */
    margin: 10px auto; /* Ajout d'un peu de marge autour des popups */
  }
}

/* Fix CSS du 12/05/25 */
.vvp-centered-logo {
  width: auto !important;
}
.vvp-items-button-and-search-container {
  margin-top: 0 !important;
  margin-left: 0 !important;
}

#vvp-header .vvp-header-links-container {
  display: block !important;
}

/* Taille de police différente
.a-ember body {
     font-size : 12px !important;
}*/

/* Taille de police pour le texte gris de la page du compte */
.grey-text {
  font-size: 12px;
}

/* Taille des fonds gris sur le compte */
#vvp-current-status-box {
  height: 200px !important;
}

.vvp-body {
  padding: 0px !important;
}

#vvp-vine-activity-metrics-box {
  height: 320px !important;
}

.a-button-text {
  /* Si nécessaire, ajustez aussi le padding pour .a-button-text */
  padding: 2px; /* Ajustement du padding pour le texte du bouton */
}

/* Modification du bouton du rapport */
.a-button-dropdown {
  width: auto;
  max-width: 300px;
}

.a-button-inner {
  padding: 5px 10px;
}

.a-dropdown-prompt {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* On retire le texte de l'écran compte */
#vvp-gold-status-perks-display * {
  visibility: hidden;
}

.a-column.a-span6.a-span-last #vvp-you-are-awesome-display {
  visibility: hidden;
}

body {
  padding-right: 0px !important;
}

.a-section.vvp-items-button-and-search-container {
  flex-direction: column !important;
}

.vvp-container-right-align {
  margin-top: 10px !important;
  width: 100% !important;
  flex-grow: 1 !important;
}

.a-icon-search {
  display: none;
}

.a-search {
  flex-grow: 1;
}

#vvp-search-text-input {
  width: 100% !important;
}

.a-tabs {
  margin: 0px !important;
}

.a-tabs li a {
  padding: 1rem !important;
}

.nav-mobile.nav-ftr-batmobile {
  display: none;
}

.vvp-tab-set-container
  [data-a-name="vine-items"]
  .a-box-inner
  .vvp-tab-content
  .vvp-items-button-and-search-container {
  margin: 0px !important;
}

#a-page
  > div.a-container.vvp-body
  > div.a-tab-container.vvp-tab-set-container
  > ul {
  margin-bottom: 0px !important;
}

.a-button-primary {
  transition: 0.2s !important;
}

.a-button-primary .a-button-inner {
  background-color: transparent !important;
}

.a-button-primary:hover {
  opacity: 0.85 !important;
}

/* Pagination styles */
.a-pagination {
  display: flex !important;
  justify-content: center;
}

.a-pagination li:first-child,
.a-pagination li:last-child {
  color: transparent !important;
  position: relative;
}

.a-pagination li.a-disabled {
  display: none !important;
}

.a-pagination li:first-child a,
.a-pagination li:last-child a {
  display: flex;
  align-content: center;
  position: relative;
  justify-content: center;
}

.a-pagination li:first-child a:before,
.a-pagination li:last-child a:before {
  position: absolute !important;
  color: white !important;
  font-size: 2rem !important;
  line-height: 4rem;
  height: 100%;
  width: 100%;
}

ul.a-pagination li:first-child a,  /* Cible le premier li de la liste, supposant que c'est Précédent */
li:last-child.a-last a {     /* Cible les li avec classe 'a-last', supposant que c'est Suivant */
  font-size: 0;
}

li:first-child a span.larr,  /* Cible le span larr dans le premier li */
li.a-last a span.larr {      /* Cible le span larr dans les li a-last */
  font-size: 16px;
  visibility: visible;
}

.a-pagination li {
  width: 40px !important;
  height: 40px !important;
}

.a-pagination li a {
  padding: 0px !important;
  margin: 0px !important;
  height: 100%;
  line-height: 40px !important;
}

.vvp-details-btn,
.vvp-details-btn-mobile {
  padding: 0.25rem 0 !important;
  margin: 0.25rem 0rem !important;
}

.vvp-details-btn .a-button-text,
.vvp-details-btn-mobile .a-button-text {
  padding: 0.5px 0.25px !important;
}

/* PRODUCT AND REVIEW PAGES */
#vvp-product-details-img-container,
#vvp-product-details-img-container img {
  height: 75px;
}

#vvp-browse-nodes-container,
#vvp-browse-nodes-container .parent-node,
#vvp-browse-nodes-container .child-node {
  width: unset !important;
}

.vvp-reviews-table .vvp-reviews-table--row,
.vvp-orders-table .vvp-orders-table--row {
  display: flex;
  flex-wrap: wrap;
}

.vvp-reviews-table tbody,
.vvp-orders-table tbody {
  display: flex !important;
  flex-wrap: wrap;
}

.vvp-reviews-table--heading-row,
.vvp-orders-table--heading-row {
  display: none !important;
}

.vvp-reviews-table td,
.vvp-orders-table td {
  padding-top: 0px !important;
  padding-bottom: 0px !important;
}

.vvp-reviews-table td.vvp-reviews-table--image-col,
.vvp-orders-table td.vvp-orders-table--image-col {
  padding-top: 10px !important;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.vvp-reviews-table td.vvp-reviews-table--image-col img,
.vvp-orders-table td.vvp-orders-table--image-col img {
  height: 75px;
}

.vvp-reviews-table--actions-col,
.vvp-orders-table--actions-col {
  width: 100% !important;
  display: flex !important;
  align-items: center !important;
}

#vvp-items-grid,
#tab-unavailable,
#tab-hidden,
#tab-favourite {
  grid-template-columns: repeat(
    auto-fill,
    minmax(var(--grid-column-width), auto)
  ) !important;
}

/*Centrer le bouton des catégories*/
#categories-sheet {
  margin-right: 8px !important;
  margin-left: -8px !important;
}

.vvp-items-button-scroll-container {
  overflow: visible !important;
}

/*Pour gérer Avis/Commandes/Compte*/
#vvp-header {
  display: flex !important;
  align-items: center; !important;
  justify-content: flex-start !important;
  font-weight: bold !important;
}

#vvp-header a.a-link-normal {
  position: relative;
  padding: 0 0.15em;
  text-decoration: none;
}

#vvp-header a.a-link-normal:last-of-type::after {
  content: "";
}

/* Pour rabaisser le logo en mobile */
#vvp-logo-link img {
  margin-top: 10px;
}

.vvp-tab-content .vvp-reviews-table--heading-top {
  margin-top: 10px;
  border: 1px solid #ddd;
}

#vvp-reviews-divider {
  display: none;
}
		`;
                    document.head.appendChild(mobileCssRR);
                }
            }

            if (!apiOk && isMobile()) {
                var noapiCss = document.createElement('style');

                noapiCss.textContent = `
#configPopup {
  width: 400px !important;
  height: 600px;
}

#colorPickerPopup, #keyConfigPopup, #favConfigPopup, #notifConfigPopup, #notePopup, #advancedConfigPopup {
  width: 400px !important;
}

/* Taille dynamique pour mobile */
@media (max-width: 600px) {
  #configPopup {
    width: 90%; /* Prendre 90% de la largeur de l'écran */
    height: 90%;
    margin: 10px auto; /* Ajout d'un peu de marge autour des popups */
  }
}

@media (max-width: 600px) {
  #colorPickerPopup, #keyConfigPopup, #favConfigPopup, #notifConfigPopup, #notePopup, #advancedConfigPopup {
    width: 90%; /* Prendre 90% de la largeur de l'écran */
    margin: 10px auto; /* Ajout d'un peu de marge autour des popups */
  }
}
`;
                document.head.appendChild(noapiCss);
            }

            //Gestion des thèmes couleurs
            //Thème
            if (savedTheme != "default") {
                if (mobileEnabled) {
                    loadCSS(baseURLCSS + savedTheme + '-theme-mobile.css');
                } else {
                    loadCSS(baseURLCSS + savedTheme + '-theme.css');
                }
            }
            //Boutons
            if (savedTheme == "dark" && savedButtonColor == "default") {
                loadCSS(baseURLCSS + 'yellow-buttons.css');
            } else if (savedButtonColor != "default") {
                loadCSS(baseURLCSS + savedButtonColor + '-buttons.css');
            }
            //End

            var API_TOKEN = GM_getValue("apiToken");

            function addGlobalStyle(css) {
                var head, style;
                head = document.getElementsByTagName('head')[0];
                if (!head) {
                    return;
                }
                style = document.createElement('style');
                style.type = 'text/css';
                style.innerHTML = css;
                head.appendChild(style);
            }

            addGlobalStyle(`.a-button-discord > .a-button-text { padding-left: 6px; }`);
            addGlobalStyle(`.a-button-discord-icon { background-image: url(https://m.media-amazon.com/images/S/sash/Gt1fHP07TsoILq3.png); content: ""; padding: 10px 10px 10px 10px; background-size: 512px 512px; background-repeat: no-repeat; margin-left: 10px; vertical-align: middle; }`);
            addGlobalStyle(`.a-button-discord.mobile-vertical { margin-top: 7px; margin-left: 0px; }`);

            //PickMe add
            //Récupérer l'enrollment
            function getEnrollment(element) {
                const recommendationId = element.getAttribute('data-recommendation-id');
                let enrollment = null;

                if (recommendationId) {
                    //Découper la chaîne pour isoler la dernière partie après le dernier '#'
                    const parts = recommendationId.split('#');
                    enrollment = parts[parts.length - 1];
                    //Supprimer "vine.enrollment." si présent
                    if (enrollment.startsWith('vine.enrollment.')) {
                        enrollment = enrollment.replace('vine.enrollment.', '');
                    }
                }
                return enrollment;
            }

            //Générer la combinaison ASIN et enrollment
            function getAsinEnrollment(asin, enrollment) {
                const enrollmentPart = enrollment.split('-')[1];
                return asin + enrollmentPart;
            }

            const urlParams = new URLSearchParams(window.location.search);

            let valeurQueue = urlParams.get('queue');
            let valeurPn = parseInt(urlParams.get('pn'), 10) || 0; //Utilisez 0 comme valeur par défaut si pn n'est pas défini
            let valeurCn = parseInt(urlParams.get('cn'), 10) || 0; //Utilisez 0 comme valeur par défaut si cn n'est pas défini
            let valeurPage = urlParams.get('page') || '1'; //'1' est utilisé comme valeur par défaut

            function waitForNonEmptyText(element) {
                return new Promise(resolve => {
                    if (!element) {
                        resolve(null);
                        return;
                    }
                    const currentText = element.textContent.trim();
                    if (currentText) {
                        resolve(currentText);
                        return;
                    }
                    const observer = new MutationObserver(() => {
                        const txt = element.textContent.trim();
                        if (txt) {
                            observer.disconnect();
                            resolve(txt);
                        }
                    });
                    observer.observe(element, { childList: true, subtree: true, characterData: true });
                });
            }

            function waitForElement(parent, selector, timeout = 2000) {
                return new Promise(resolve => {
                    const existing = parent.querySelector(selector);
                    if (existing) {
                        resolve(existing);
                        return;
                    }
                    const observer = new MutationObserver(() => {
                        const el = parent.querySelector(selector);
                        if (el) {
                            observer.disconnect();
                            clearTimeout(timer);
                            resolve(el);
                        }
                    });
                    observer.observe(parent, { childList: true, subtree: true });
                    const timer = setTimeout(() => {
                        observer.disconnect();
                        resolve(null);
                    }, timeout);
                });
            }

            //Tester si le produit est NSFW
            function NSFWTest(productUrl) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    url: productUrl,
                    queue: valeurQueue,
                });

                return fetch(baseUrlPickme + "/shyrka/nsfw", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    return response.text().then(text => {
                        //Convertit la réponse en entier (0 ou 1)
                        return text;
                    });
                })
                    .catch(error => {
                    console.error(error);
                    updateButtonIcon(6);
                    throw error;
                });
            }

            const items = document.querySelectorAll('.vvp-item-tile');
            const listElements = [];
            const listElementsOrder = [];

            let elementsToPrepend = [];

            const processingPromises = Array.from(items).map(async element => {
                //Récupérer le lien principal (desktop)
                let linkElement = element.querySelector('.vvp-item-product-title-container > a.a-link-normal');
                const inputEl = element.querySelector('input[data-asin]');
                const isPrerelease = inputEl ? inputEl.getAttribute('data-is-pre-release') === 'true' : false;
                let asin = null;
                let productUrl = null;
                let title = null;
                const btnMobile = element.querySelector('.a-button.a-button-primary.vvp-details-btn-mobile');
                if (btnMobile) {
                    //Cas mobile : on cherche le bouton à la place
                    asin = inputEl ? inputEl.getAttribute('data-asin') : null;
                    let fullTextElement = element.querySelector('.a-truncate-full.a-offscreen');

                    //On essaie de récupérer l'élément contenant le titre complet
                    if (!fullTextElement) {
                        fullTextElement = await waitForElement(element, '.a-truncate-full.a-offscreen');
                    }
                    //Sinon on récupère l'élément avec le texte tronqué
                    if (!fullTextElement) {
                        fullTextElement = element.querySelector('.a-truncate-cut');
                    }

                    //Même si l'élément à été récupéré, son texte peut être vide, on attend qu'il soit rempli
                    if (fullTextElement) {
                        title = await waitForNonEmptyText(fullTextElement);
                    }
                    productUrl = "https://www.amazon.fr/dp/" + asin;

                    const container = element.querySelector('.vvp-item-product-title-container');
                    if (container) {
                        if (!linkElement) {
                            linkElement = document.createElement('a');
                            linkElement.className = 'a-link-normal';
                            linkElement.target = '_blank';
                            linkElement.rel = 'noopener';
                            const span = container.firstElementChild;
                            if (span) {
                                linkElement.appendChild(span);
                            }
                            container.appendChild(linkElement);
                        }
                        linkElement.href = productUrl;
                    }
                } else {
                    if (linkElement && linkElement.href) {
                        //Cas desktop : tout est dans le lien
                        title = linkElement.innerText.trim();
                        productUrl = linkElement.href;
                        const match = productUrl.match(/\/dp\/([A-Z0-9]{10})/i);
                        asin = match ? match[1] : null;
                    } else {
                        //Traitement pour fix produit pré-release sans lien direct (sur PC uniquement)

                        asin = inputEl ? inputEl.getAttribute('data-asin') : null;

                        //On récupère le titre dans les mêmes éléments que sur mobile car le lien n'est pas présent
                        const fullTextElement =
                              element.querySelector('.a-truncate-full.a-offscreen') ||
                              element.querySelector('.a-truncate-cut');

                        if (fullTextElement) {
                            title = await waitForNonEmptyText(fullTextElement);
                        }
                        if (!asin) {
                            const carousel = document.querySelector('div[data-a-carousel-options]');
                            if (carousel) {
                                try {
                                    const opts = JSON.parse(carousel.getAttribute('data-a-carousel-options'));
                                    const idList = opts?.ajax?.id_list;
                                    if (Array.isArray(idList) && idList.length > 0) {
                                        const first = JSON.parse(idList[0]);
                                        asin = first.id || asin;
                                    }
                                } catch (e) {
                                    console.error('Failed to parse carousel options', e);
                                }
                            }
                        }
                        if (asin) {
                            productUrl = "https://www.amazon.fr/dp/" + asin;
                            const container = element.querySelector('.vvp-item-product-title-container');
                            if (container) {
                                if (!linkElement) {
                                    linkElement = document.createElement('a');
                                    linkElement.className = 'a-link-normal';
                                    linkElement.target = '_blank';
                                    linkElement.rel = 'noopener';
                                    const span = container.firstElementChild;
                                    if (span) {
                                        linkElement.appendChild(span);
                                    }
                                    container.appendChild(linkElement);
                                }
                                linkElement.href = productUrl;
                            }
                        }
                    }
                }

                //Récupérer l'URL de l'image
                const imgElement = element.querySelector('img');
                const imgUrl = imgElement ? imgElement.src : null;
                const currentDate = new Date();

                //Récupérer l'enrollment
                let enrollment = getEnrollment(element);

                if (NSFWEnabled || NSFWHide) {
                    (async () => {
                        const NSFWInfo = await NSFWTest(productUrl);
                        if (NSFWInfo === '1') {
                            if (NSFWHide && hideEnabled) {
                                const hideKey = getAsinEnrollment(asin, enrollment);
                                const etatCacheKey = hideKey + '_c';
                                localStorage.setItem(etatCacheKey, '1');
                                element.style.display = 'none';
                            }
                            if (NSFWEnabled) {
                                imgElement.style.transition = 'filter 0.3s ease';
                                imgElement.style.filter = `blur(${blurLevel}px)`;

                                imgElement.addEventListener('click', () => {
                                    if (imgElement.style.filter === `blur(${blurLevel}px)`) {
                                        imgElement.style.filter = 'blur(0px)';
                                    } else {
                                        imgElement.style.filter = `blur(${blurLevel}px)`;
                                    }
                                });
                            }
                        }
                    })();
                }
                //Ajouter les données récupérées dans le tableau
                listElements.push({
                    title: title,
                    imgUrl: imgUrl,
                    productUrl: productUrl,
                    enrollment: enrollment,
                    isPrerelease: isPrerelease ? 1 : 0
                });
                listElementsOrder.push(productUrl);
                if ((firsthlEnabled || highlightEnabled) && apiOk) {
                    //const containerDiv = document.getElementById('vvp-items-grid'); //L'élément conteneur de tous les produits
                    //Vérifier si le produit existe déjà dans les données locales
                    const enrollmentKey = getAsinEnrollment(asin, enrollment);
                    if (!storedProducts.hasOwnProperty(asin)) {
                        //Si le produit n'existe pas, l'ajouter aux données locales avec la date courante
                        const currentDate = new Date().toISOString(); //Obtenir la date courante en format ISO

                        storedProducts[asin] = {
                            added: true, //Marquer le produit comme ajouté
                            enrollmentKey: enrollmentKey,
                            dateAdded: currentDate, //Stocker la date d'ajout
                            firstSeen: false
                        };

                        //On le marque comme étant nouveau pour le retrouver plus tard
                        element.classList.add('newproduct');

                        //Appliquer la mise en surbrillance au div parent
                        if (highlightEnabled) {
                            element.style.backgroundColor = highlightColor;
                            imgNew = true;
                        }
                        //On stocke les produits qu'on va devoir remonter
                        if (firsthlEnabled) {
                            //containerDiv.prepend(element);
                            elementsToPrepend.push(element);
                            imgNew = true;
                        }
                    } else if (storedProducts[asin] && storedProducts[asin].enrollmentKey != enrollmentKey) {
                        storedProducts[asin].enrollmentKey = enrollmentKey;
                        if (highlightEnabled) {
                            element.style.backgroundColor = highlightColorRepop;
                            imgNew = true;
                        }
                        if (firsthlEnabled) {
                            elementsToPrepend.push(element);
                            imgNew = true;
                        }
                    } else if (firstSeenEnabled && firstSeenAllTime && storedProducts[asin]?.firstSeen) {
                        const imgFirstSeen = firstSeenUrl;
                        const wrapper = imgElement.parentElement;
                        if (getComputedStyle(wrapper).position === 'static') {
                            wrapper.style.position = 'relative';
                        }
                        //Pour savoir si on met l'image par dessus le temps ou non
                        var firstSeenIndex = '4';
                        if (firstSeenOver) {
                            firstSeenIndex = '6';
                        }
                        const overlay = document.createElement('img');
                        overlay.src = imgFirstSeen;
                        overlay.alt = "First seen";
                        Object.assign(overlay.style, {
                            position:'absolute',
                            top: mobileEnabled ? firstSeenVerticalMobile : firstSeenVertical,
                            left: mobileEnabled ? firstSeenHorizontalMobile : firstSeenHorizontal,
                            width: mobileEnabled ? firstSeenWidthMobile : firstSeenWidth,
                            height: mobileEnabled ? firstSeenHeightMobile : firstSeenHeight,
                            zIndex: firstSeenIndex
                        });

                        wrapper.appendChild(overlay);

                    }
                }
                //Modifier le texte du bouton détails
                changeButtonProduct(element);
            });

            Promise.all(processingPromises).then(() => {
                GM_setValue("storedProducts", JSON.stringify(storedProducts)); //Sauvegarder les changements (après le précédent traitement)

                //On remonte les produits dans leur ordre initial
                if (firsthlEnabled && apiOk) {
                    const containerDiv = document.getElementById('vvp-items-grid'); //L'élément conteneur de tous les produits
                    if (containerDiv) {
                        elementsToPrepend.reverse().forEach(element => {
                            containerDiv.prepend(element);
                        });
                    }
                }

                //Bouton de commandes rapides
                if (fastCmd && apiOk) {
                    addFastCmd();
                }

                //Appel des webhooks
                if (imgNew && apiOk && valeurQueue == "potluck") {
                    //Webhook classique
                    if (callUrlEnabled && callUrl) {
                        appelURL(callUrl);
                    }
                    //Webhook avec filtres
                    if (callUrlFavEnabled && callUrlFav) {
                        if (callUrlTypeFav == "callFavOnly") {
                            var favWordsTrim = favWords.trim();
                            var favArrayUrl = favWordsTrim.length > 0
                            ? favWordsTrim.split(',').map(pattern => {
                                pattern = pattern.trim();
                                if (pattern.length > 0) {
                                    try {
                                        return new RegExp(pattern, 'i');
                                    } catch (e) {
                                        console.error('Expression regex invalide :', pattern, e);
                                        return null;
                                    }
                                } else {
                                    return null;
                                }
                            }).filter(regex => regex != null)
                            : [];

                        } else if (callUrlTypeFav == "callExcludeHidden") {
                            var hiddenWordsTrim = hideWords.trim();
                            var hiddenArrayUrl = hiddenWordsTrim.length > 0
                            ? hiddenWordsTrim.split(',').map(pattern => {
                                pattern = pattern.trim();
                                if (pattern.length > 0) {
                                    try {
                                        return new RegExp(pattern, 'i');
                                    } catch (e) {
                                        console.error('Expression regex invalide :', pattern, e);
                                        return null;
                                    }
                                } else {
                                    return null;
                                }
                            }).filter(regex => regex != null)
                            : [];
                        }
                        setTimeout(() => {
                            const newProducts = document.querySelectorAll('.newproduct');
                            if (newProducts.length > 0) {
                                newProducts.forEach((produit) => {
                                    const nameElement = produit.querySelector('.a-truncate-full.a-offscreen');
                                    if (nameElement) {
                                        const fullName = nameElement.textContent.toLowerCase().trim().replace(/\s+/g, '');
                                        if (callUrlTypeFav == "callFavOnly") {
                                            if (favArrayUrl.length > 0 && favArrayUrl.some(regex => regex.test(fullName))) {
                                                appelURL(callUrlFav);
                                            }
                                        } else if (callUrlTypeFav == "callExcludeHidden") {
                                            if (hiddenArrayUrl.length > 0 && !hiddenArrayUrl.some(regex => regex.test(fullName))) {
                                                appelURL(callUrlFav);
                                            }
                                        }
                                    }
                                });
                            }
                        }, 1000);
                    }
                }

                if (imgNew && apiOk && soundRecoEnabled && recoSoundUrl && valeurQueue == "potluck") {
                    playSound(recoSoundUrl);
                }

                //Durée maximale de l'ancienneté en millisecondes (ici: 1 jour)
                const MAX_c_AGE = 24 * 60 * 60 * 1000;

                //Fonction pour vérifier si une page est potentiellement chargée depuis un cache ancien
                function isPageCachedOld() {
                    //Récupère la date de dernière visite stockée
                    const lastVisit = GM_getValue('lastVisit', null);
                    const now = new Date().getTime();

                    if (lastVisit) {
                        const lastVisitDate = new Date(lastVisit);
                        const age = now - lastVisitDate.getTime();

                        //Si l'âge est supérieur à MAX_c_AGE, on considère la page comme obsolète
                        if (age > MAX_c_AGE) {
                            GM_setValue('lastVisit', now);
                            return true;
                        }
                    }

                    //Met à jour la date de dernière visite
                    GM_setValue('lastVisit', now);
                    return false;
                }

                if (listElements.length > 0 && !isPageCachedOld()) {
                    sendDatasToAPI(listElements)
                        .then(urlArray => {
                        //Si aucune URL nouvelle, on sort
                        if (!urlArray || urlArray.length === 0) return;

                        const imgFirstSeen = firstSeenUrl;
                        const items = document.querySelectorAll('.vvp-item-tile');

                        items.forEach(element => {
                            //Récupère le lien produit
                            const linkElement = element.querySelector('.vvp-item-product-title-container > a.a-link-normal');
                            const productUrl = linkElement ? linkElement.href : null;
                            //Si c'est une URL "first seen"
                            if (productUrl && urlArray.includes(productUrl)) {
                                const asin = linkElement.href.split('/dp/')[1].split('/')[0];
                                storedProducts[asin].firstSeen = true;
                                if (apiOk && firstSeenEnabled) {
                                    element.classList.add('firstproduct');
                                    const imgElement = element.querySelector('img');
                                    if (!imgElement) return;
                                    const wrapper = imgElement.parentElement;
                                    if (getComputedStyle(wrapper).position === 'static') {
                                        wrapper.style.position = 'relative';
                                    }

                                    const overlay = document.createElement('img');
                                    overlay.src = imgFirstSeen;
                                    overlay.alt = "First seen";
                                    Object.assign(overlay.style, {
                                        position:'absolute',
                                        top: mobileEnabled ? firstSeenVerticalMobile : firstSeenVertical,
                                        left: mobileEnabled ? firstSeenHorizontalMobile : firstSeenHorizontal,
                                        width: mobileEnabled ? firstSeenWidthMobile : firstSeenWidth,
                                        height: mobileEnabled ? firstSeenHeightMobile : firstSeenHeight,
                                        zIndex:'4'
                                    });

                                    wrapper.appendChild(overlay);
                                }
                            }
                        });
                        GM_setValue("storedProducts", JSON.stringify(storedProducts));
                    })
                        .catch(err => {
                        console.error("Erreur API :", err);
                    });

                    if (ordersInfos && ordersEnabled && window.location.href.startsWith("https://www.amazon.fr/vine/vine-items?queue=")) {
                        ordersPost(listElementsOrder);
                    }
                }

            });

            function resetEtMiseAJour() {
                imgNew = true;
                updateCat(false, true);
            }

            //Fleche pour cacher le menu
            if (!mobileEnabled && apiOk) {
                const styles = `
        .hidden {
            display: none;
        }
        .arrow {
            cursor: pointer;
            transition: transform 0.3s ease;
            width: 20px;
            height: 20px;
            vertical-align: middle;
            margin-right: 5px;
        }
        .rotate-180 {
            transform: rotate(180deg);
        }
    `;

                const styleSheet = document.createElement("style");
                styleSheet.type = "text/css";
                styleSheet.innerText = styles;
                document.head.appendChild(styleSheet);

                let imageUrl = baseUrlPickme + "/img/arrowyellowleft.png";
                if (savedButtonColor === "blue") {
                    imageUrl = baseUrlPickme + "/img/arrowleft.png";
                } else if (savedButtonColor === "black") {
                    imageUrl = baseUrlPickme + "/img/arrowdarkleft.png";
                } else if (savedButtonColor === "pink") {
                    imageUrl = baseUrlPickme + "/img/arrowpinkleft.png";
                } else if (savedButtonColor === "purple") {
                    imageUrl = baseUrlPickme + "/img/arrowpurpleleft.png";
                } else if (savedButtonColor === "red") {
                    imageUrl = baseUrlPickme + "/img/arrowredleft.png";
                } else if (savedButtonColor === "green") {
                    imageUrl = baseUrlPickme + "/img/arrowgreenleft.png";
                } else if (savedButtonColor === "orange") {
                    imageUrl = baseUrlPickme + "/img/arroworangeleft.png";
                }

                const arrow = $('<img src="' + imageUrl + '" alt="Toggle Menu" id="toggle-arrow" class="arrow">');

                //Insérer l'icône devant le texte "Affichage de..."
                const targetParagraph = $('#vvp-items-grid-container p').first();
                targetParagraph.prepend(arrow);

                const $menu = $('#vvp-browse-nodes-container');
                const $arrow = $('#toggle-arrow');

                const isMenuHidden = GM_getValue('isMenuHidden', false);
                if (isMenuHidden) {
                    $menu.addClass('hidden');
                    $arrow.addClass('rotate-180');
                }

                $arrow.on('click', function () {
                    $menu.toggleClass('hidden');
                    $arrow.toggleClass('rotate-180');
                    GM_setValue('isMenuHidden', $menu.hasClass('hidden'));
                });
            }
            //End

            //Affichage de la différence des catégories
            function updateCat(firstLoad = true, forceReset = false) {
                const isMobile = () => window.innerWidth <= 768;

                //Extraction des catégories, version adaptative
                const extraireNombres = () => {
                    const resultats = {};
                    if (isMobile()) {
                        const categories = document.querySelectorAll('.vvp-mobile-category-sheet-item');
                        categories.forEach(cat => {
                            const nomEl = cat.querySelector('#vvp-parent-node-row');
                            if (!nomEl) return;
                            const match = nomEl.textContent.trim().match(/^(.+?)\s*\((\d+)\)$/);
                            if (match) {
                                const nom = match[1].trim();
                                const nombre = parseInt(match[2], 10);
                                resultats[nom] = isNaN(nombre) ? 0 : nombre;
                            }
                        });
                    } else {
                        const categories = document.querySelectorAll('.parent-node');
                        categories.forEach(cat => {
                            const nomElement = cat.querySelector('a');
                            const nombreElement = cat.querySelector('span');
                            if (nomElement && nombreElement) {
                                const nom = nomElement.textContent.trim();
                                const nombre = parseInt(nombreElement.textContent.trim().replace(/[()]/g, ''), 10);
                                resultats[nom] = isNaN(nombre) ? 0 : nombre;
                            }
                        });
                    }
                    return resultats;
                };

                const extraireNombreTotal = () => {
                    const texteTotalElement = document.querySelector('#vvp-items-grid-container > p');
                    if (texteTotalElement) {
                        const texteTotal = texteTotalElement.textContent.trim();
                        const match = texteTotal.match(/sur (\d+[\s\u00A0\u202F\u2009]*\d*)/);
                        if (match) {
                            const nombreTotal = parseInt(match[1].replace(/[\s\u00A0\u202F\u2009]/g, ''), 10);
                            return isNaN(nombreTotal) ? 0 : nombreTotal;
                        }
                    }
                    return 0;
                };

                const comparerEtAfficherTotal = (nouveauTotal) => {
                    const ancienTotal = parseInt(localStorage.getItem('nombreTotalRésultats') || '0', 10);
                    const differenceTotal = nouveauTotal - ancienTotal;
                    if (differenceTotal !== 0 && firstLoad) {
                        const containerTotal = document.querySelector('#vvp-items-grid-container > p');
                        if (containerTotal) {
                            const spanTotal = document.createElement('span');
                            spanTotal.textContent = ` (${differenceTotal > 0 ? '+' : ''}${differenceTotal})`;
                            spanTotal.style.color = differenceTotal > 0 ? 'green' : 'red';
                            if (catGras) spanTotal.style.fontWeight = 'bold';
                            containerTotal.appendChild(spanTotal);
                        }
                    }
                    if (imgNew && (window.location.href.includes("queue=encore") || window.location.href.includes("queue=all_items")) && (!catManuelReset || forceReset)) {
                        localStorage.setItem('nombreTotalRésultats', JSON.stringify(nouveauTotal));
                    }
                };

                const comparerEtAfficher = (nouveauxNombres) => {
                    const anciensNombres = JSON.parse(localStorage.getItem('nombresCatégories') || '{}');

                    Object.keys(nouveauxNombres).forEach(nom => {
                        const nouveauxNombresVal = nouveauxNombres[nom] || 0;
                        const anciensNombresVal = anciensNombres[nom] || 0;
                        const difference = nouveauxNombresVal - anciensNombresVal;
                        if (difference !== 0 && firstLoad) {
                            if (isMobile()) {
                                const parentRows = [...document.querySelectorAll('#vvp-parent-node-row')];
                                const elementCategorie = parentRows.find(el => el.textContent.trim().startsWith(nom));
                                if (elementCategorie) {
                                    const span = document.createElement('span');
                                    span.textContent = ` (${difference > 0 ? '+' : ''}${difference})`;
                                    span.style.setProperty('color', difference > 0 ? 'green' : 'red', 'important');
                                    if (catGras) span.style.setProperty('font-weight', 'bold', 'important');
                                    elementCategorie.appendChild(span);
                                }
                            } else {
                                const elementCategorie = [...document.querySelectorAll('.parent-node')]
                                .find(el => el.querySelector('a')?.textContent.trim() === nom);
                                if (elementCategorie) {
                                    const span = document.createElement('span');
                                    span.textContent = ` (${difference > 0 ? '+' : ''}${difference})`;
                                    span.style.setProperty('color', difference > 0 ? 'green' : 'red', 'important');
                                    if (catGras) span.style.setProperty('font-weight', 'bold', 'important');
                                    elementCategorie.appendChild(span);
                                }
                            }
                        }
                    });

                    if (imgNew && (window.location.href.includes("queue=encore") || window.location.href.includes("queue=all_items")) && (!catManuelReset || forceReset)) {
                        localStorage.setItem('nombresCatégories', JSON.stringify(nouveauxNombres));
                    }

                    if (!firstLoad) {
                        window.location.reload();
                    }
                };

                const nombresActuels = extraireNombres();
                comparerEtAfficher(nombresActuels);

                const urlActuelle = new URL(window.location.href);
                const paramPn = urlActuelle.searchParams.get("pn");
                if (paramPn === null || paramPn === '') {
                    const nombreTotalActuel = extraireNombreTotal();
                    comparerEtAfficherTotal(nombreTotalActuel);
                }
            }

            if ((window.location.href.includes("queue=encore") || window.location.href.includes("queue=all_items")) && catEnabled && apiOk) {
                updateCat();
                //Création du bouton "Reset"
                const boutonReset = document.createElement('button');
                boutonReset.textContent = 'Reset';
                boutonReset.classList.add('bouton-reset');
                boutonReset.addEventListener('click', resetEtMiseAJour);

                if (!mobileEnabled && !isMobile()) {
                    //Sélection du conteneur où insérer le bouton "Reset"
                    const conteneur = document.querySelector('#vvp-browse-nodes-container > p');
                    if (conteneur) {
                        conteneur.appendChild(boutonReset);
                    }
                } else if (mobileEnabled && !isMobile()) {
                    const lienAfficherTout = document.querySelector('#vvp-browse-nodes-container .vvp-browse-nodes-content > p > a');
                    if (lienAfficherTout && lienAfficherTout.parentElement) {
                        //Insertion du bouton juste après le lien "Afficher tout"
                        lienAfficherTout.insertAdjacentElement('afterend', boutonReset);
                    }
                } else if (isMobile()) {
                    //Sélection de l'élément contenant le lien "Afficher tout"
                    const conteneurAfficherTout = document.querySelector('.vvp-mobile-show-all');

                    if (conteneurAfficherTout) {
                        //Insertion du bouton juste après le lien
                        const lienAfficherTout = conteneurAfficherTout.querySelector('a');
                        if (lienAfficherTout) {
                            lienAfficherTout.insertAdjacentElement('afterend', boutonReset);
                        }
                    }
                }
            }

            //Affichage de l'image New
            if (imgNew) {
                //Créer l'élément image
                const imageElement = document.createElement('img');
                imageElement.src = newUrl;
                imageElement.style.cssText = 'height: 15px; width: 35px; margin-left: 10px; vertical-align: middle;';

                //Trouver l'élément après lequel insérer l'image
                //Cela suppose que le paragraphe avec les résultats est toujours présent et correctement positionné
                const paragraphResults = document.querySelector('#vvp-items-grid-container > p');

                if (paragraphResults) {
                    //Insérer l'image après le paragraphe des résultats
                    paragraphResults.appendChild(imageElement);
                }
            }

            const urlData = window.location.href.match(/(amazon\..+)\/vine\/vine-items(?:\?queue=)?(encore|last_chance|potluck|all_items)?.*?(?:&page=(\d+))?$/); //Country and queue type are extrapolated from this
            //End
            const MAX_COMMENT_LENGTH = 900;
            const PRODUCT_IMAGE_ID = /.+\/(.*)\._SS[0-9]+_\.[a-z]{3,4}$/;
            //Icons for the Share button
            const btn_discordSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -15 130 130" style="height: 29px; padding: 4px 0px 4px 10px;">
        <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" style="fill: #5865f2;"></path>
    </svg>`;
            const btn_loadingAnim = `<span class="a-spinner a-spinner-small" style="margin-left: 10px;"></span>`;
            const btn_checkmark = `<span class='a-button-discord-icon a-button-discord-success a-hires' style='background-position: -83px -116px;'></span>`;
            const btn_warning = `<span class='a-button-discord-icon a-button-discord-warning a-hires' style='background-position: -83px -96px;'></span>`;
            const btn_error = `<span class='a-button-discord-icon a-button-discord-error a-hires' style='background-position: -451px -422px;'></span>`;
            const btn_info = `<span class='a-button-discord-icon a-button-discord-info a-hires' style='background-position: -257px -354px;'></span>`;

            //Recherche des messages d'erreurs
            const errorMessages = document.querySelectorAll('#vvp-product-details-error-alert, #vvp-out-of-inventory-error-alert');

            //PickMe add
            function purgeStoredProducts(purgeAll = false) {
                let products = getStoredProducts();

                const currentDate = new Date().getTime();

                //Parcourir les clés (ASIN) dans storedProducts
                for (const asin in products) {
                    if (products.hasOwnProperty(asin)) { //Vérification pour éviter les propriétés héritées
                        const cacheKey = asin + '_c';
                        const favoriKey = asin + '_f';
                        if (purgeAll) {
                            //Purger le produit sans vérifier la date
                            products = {};
                            saveStoredProducts(products);
                            storedProducts = products;
                            return;
                        } else {
                            //Purger le produit en fonction de la date d'expiration
                            const productDateAdded = new Date(products[asin].dateAdded).getTime(); //Convertir la date d'ajout en millisecondes
                            if (currentDate - productDateAdded >= ITEM_EXPIRY) { //Vérifier si le produit a expiré
                                if (products[asin] && products[asin].enrollmentKey) {
                                    const hideKey = products[asin].enrollmentKey + '_c';
                                    localStorage.removeItem(hideKey);
                                }
                                //On supprime l'ancienne clé pour cacher pour l'instant (utilisé avant la 1.14)
                                localStorage.removeItem(cacheKey);
                                localStorage.removeItem(favoriKey);
                                delete products[asin]; //Supprimer le produit expiré
                            }
                        }
                    }
                }

                //Sauvegarder les modifications apportées à storedProducts
                saveStoredProducts(products);
                storedProducts = products;
            }

            function purgeHiddenObjects(purgeAll = false) {
                let purgeFavorites = false;
                let purgeHidden = false;

                //Poser la question pour les produits cachés et les favoris si purgeAll est vrai
                if (purgeAll) {
                    purgeHidden = confirm("Êtes-vous sur de vouloir supprimer tous les produits cachés ?");
                    purgeFavorites = confirm("Voulez-vous supprimer tous les favoris ?");
                }

                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    const isCacheKey = key.includes('_c');
                    const isFavoriKey = key.includes('_f');
                    if (isCacheKey || isFavoriKey) {
                        if (isCacheKey && purgeHidden) {
                            localStorage.removeItem(key);
                        } else if (isFavoriKey && purgeFavorites) {
                            localStorage.removeItem(key);
                        }
                    }
                }
                const button = document.getElementById('purgeAllItems');
                button.innerHTML = `Purger la mémoire ${afficherMemoireLocalStorage()}`;
                alert("Suppression réussie.");
            }

            function purgeAllItems() {
                const userHideAll = confirm("Voulez-vous également cacher tous les produits ? OK pour oui, Annuler pour non.");
                const button = document.getElementById('purgeAllItems');

                //Étape 1 : Mise à jour initiale du bouton
                button.innerHTML = `En cours (0%)`;

                //Étape 2 : Purger les favoris et les caches
                setTimeout(() => {
                    for (let i = localStorage.length - 1; i >= 0; i--) {
                        const key = localStorage.key(i);
                        const isCacheKey = key.includes('_c') || key.includes('_cache');
                        const isFavoriKey = key.includes('_f') || key.includes('_favori');

                        if (isCacheKey || isFavoriKey) {
                            //Si c'est une clé favori (_f), vérifier la valeur
                            if (isFavoriKey && localStorage.getItem(key) === '1') {
                                continue; //Ne pas supprimer si la valeur vaut '1'
                            }

                            localStorage.removeItem(key);
                        }
                    }
                    button.innerHTML = `En cours (33%)`;

                    //Étape 3 : Purger la surbrillance
                    setTimeout(() => {
                        let products = {};

                        saveStoredProducts(products);
                        storedProducts = products; // <-- mise à jour globale

                        saveStoredProducts(products);
                        storedProducts = products;

                        button.innerHTML = `En cours (66%)`;

                        //Étape 4 : Synchronisation des produits
                        setTimeout(() => {
                            syncProducts(false, userHideAll, false);

                            button.innerHTML = `Terminé (100%)`;

                            //Étape 5 : Mise à jour finale du bouton
                            setTimeout(() => {
                                button.innerHTML = `Purger la mémoire ${afficherMemoireLocalStorage()}`;
                            }, 1000); //1 seconde avant la mise à jour finale

                        }, 1000); //1 seconde avant de passer à la synchronisation des produits

                    }, 1000); //1 seconde avant de purger la surbrillance

                }, 1000); //1 seconde avant de purger les favoris et les caches
            }

            //On affiche les pages en haut si l'option est activée
            //Pour chercher '.a-text-center' ou 'nav.a-text-center'
            function findPaginationBlock() {
                // Cherche tous les éléments .a-text-center qui contiennent un ul.a-pagination
                return Array.from(document.querySelectorAll('.a-text-center'))
                    .find(el => el.querySelector('ul.a-pagination') && (
                    el.tagName === 'NAV' || el.getAttribute('role') === 'navigation'
                ));
            }

            if (paginationEnabled && apiOk) {
                //Sélection du contenu HTML du div source
                const sourceElement = findPaginationBlock();
                //Vérifier si l'élément source existe
                if (sourceElement) {

                    /*//Ajout de pages
                const numberOfAdditionalPages = 3;
                const url = new URL(window.location);
                const params = url.searchParams;
                const currentPage = parseInt(params.get('page') || '1', 10);
                let ellipsisElement = null;
                //Trouver ou créer le conteneur de pagination si nécessaire
                let paginationContainer = sourceElement.querySelector('.a-pagination');
                if (!paginationContainer) {
                    paginationContainer = document.createElement('ul');
                    paginationContainer.className = 'a-pagination';
                    sourceElement.appendChild(paginationContainer);
                }
                const paginationItems = paginationContainer.querySelectorAll('li.a-disabled[aria-disabled="true"]');
                paginationItems.forEach(function(item) {
                    if (item.textContent.trim() === '...') {
                        ellipsisElement = item;
                    }
                });

                //Si l'élément "..." est trouvé, insérer les pages supplémentaires avant lui
                if (ellipsisElement) {
                    //Boucle pour créer et insérer les pages supplémentaires
                    for (let i = 4; i < 4 + numberOfAdditionalPages; i++) {
                        const pageLi = document.createElement('li');
                        if (i === currentPage) {
                            pageLi.className = 'a-selected';
                            pageLi.innerHTML = `<a href="?page=${i}" aria-current="page">${i}</a>`;
                        } else {
                            pageLi.className = 'a-normal';
                            pageLi.innerHTML = `<a href="?page=${i}">${i}</a>`;
                        }
                        //Insérer le nouvel élément avant l'élément "..."
                        paginationContainer.insertBefore(pageLi, ellipsisElement);
                    }
                }
                //Maintenant que l'élément source a été mis à jour, copier son contenu HTML
                const sourceContent = sourceElement.outerHTML;

                //Création d'un nouveau div pour le contenu copié
                const newDiv = document.createElement('div');
                newDiv.innerHTML = sourceContent;
                newDiv.style.textAlign = 'center'; //Centrer le contenu
                newDiv.style.paddingBottom = '10px'; //Ajouter un petit espace après

                //Sélection du div cible où le contenu sera affiché
                const targetDiv = document.getElementById('vvp-items-grid-container');

                //S'assurer que le div cible existe avant d'insérer le nouveau div
                if (targetDiv) {
                    //Insertion du nouveau div au début du div cible
                    targetDiv.insertBefore(newDiv, targetDiv.firstChild);
                }*/

                    //Maintenant que l'élément source a été mis à jour, copier son contenu HTML
                    const sourceContent = sourceElement.outerHTML;

                    //Création d'un nouveau div pour le contenu copié
                    const newDiv = document.createElement('div');
                    newDiv.innerHTML = sourceContent;
                    newDiv.style.textAlign = 'center'; //Centrer le contenu
                    newDiv.style.paddingBottom = '10px'; //Ajouter un petit espace après

                    //Sélection du div cible où le contenu sera affiché
                    const targetDiv = document.getElementById('vvp-items-grid-container');

                    //S'assurer que le div cible existe avant d'insérer le nouveau div
                    if (targetDiv) {
                        //Insertion du nouveau div au début du div cible
                        targetDiv.insertBefore(newDiv, targetDiv.firstChild);
                    }
                    //Trouver ou créer le conteneur de pagination si nécessaire
                    let paginationContainer = sourceElement.querySelector('.a-pagination');
                    if (!paginationContainer) {
                        paginationContainer = document.createElement('ul');
                        paginationContainer.className = 'a-pagination';
                        sourceElement.appendChild(paginationContainer);
                    }

                    //Ajout du bouton "Aller à" en haut et en bas
                    if (window.location.href.includes("queue=encore") || window.location.href.includes("queue=all_items")) {
                        //Création du bouton "Aller à la page X"
                        const gotoButtonUp = document.createElement('li');
                        gotoButtonUp.className = 'a-last'; //Utiliser la même classe que le bouton "Suivant" pour le style
                        gotoButtonUp.innerHTML = `<a id="goToPageButton">${pageX}<span class="a-letter-space"></span><span class="a-letter-space"></span></a>`;

                        //Ajouter un événement click au bouton "Aller à"
                        gotoButtonUp.querySelector('a').addEventListener('click', function() {
                            askPage();
                        });

                        //Création du bouton "Aller à la page X"
                        const gotoButton = document.createElement('li');
                        gotoButton.className = 'a-last'; //Utiliser la même classe que le bouton "Suivant" pour le style
                        gotoButton.innerHTML = `<a id="goToPageButton">${pageX}<span class="a-letter-space"></span><span class="a-letter-space"></span></a>`;

                        //Ajouter un événement click au bouton "Aller à"
                        gotoButton.querySelector('a').addEventListener('click', function() {
                            askPage();
                        });
                        //On insère Page X en début de page
                        const pagination = newDiv.querySelector('.a-pagination');
                        const aLast = pagination?.querySelector('.a-last');

                        if (pagination && aLast) {
                            pagination.insertBefore(gotoButtonUp, aLast);
                        }
                        //On insère en bas de page
                        paginationContainer.insertBefore(gotoButton, paginationContainer.querySelector('.a-last'));
                    }
                }
            }

            //Menu PickMe
            //Ajoute le style CSS pour la fenêtre popup flottante
            const styleMenu = document.createElement('style');
            styleMenu.type = 'text/css';
            styleMenu.innerHTML = `
#configPopup, #keyConfigPopup, #favConfigPopup, #colorPickerPopup, #notifConfigPopup, #notePopup, #advancedConfigPopup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10000;
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  width: 500px; /* Ajusté pour mieux s'adapter aux deux colonnes de checkbox */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  cursor: auto;
  border: 2px solid #ccc; /* Ajout d'un contour */
  overflow: auto; /* Ajout de défilement si nécessaire */
  resize: both; /* Permet le redimensionnement horizontal et vertical */
  max-height: 95vh;
}

body.modal-open {
  overflow: hidden;
}

.api-token-container label, .theme-container label {
  margin-bottom: 0 !important;
  display: block !important;
}

.full-width {
  flex-basis: 100%;
}

#configPopup h2, #configPopup label, #keyConfigPopup h2, #colorPickerPopup h2, #notifConfigPopup h2, #advancedConfigPopup h2 {
  color: #333;
  margin-bottom: 20px;
}

#configPopup h2 {
  cursor: grab;
  font-size: 1.5em;
  text-align: center;
}

#keyConfigPopup h2, #favConfigPopup h2, #colorPickerPopup h2, #notifConfigPopup h2, #notePopup h2, #advancedConfigPopup h2 {
  font-size: 1.5em;
  text-align: center;
}

#configPopup label, #keyConfigPopup label, #favConfigPopup label, #notifConfigPopup label, #notePopup label, #advancedConfigPopup label {
  display: flex;
  align-items: center;
}

#configPopup label input[type="checkbox"], #notifConfigPopup label input[type="checkbox"] {
  margin-right: 10px;
}

#configPopup .button-container,
#configPopup .checkbox-container,
#notifConfigPopup .button-container,
#notifConfigPopup .checkbox-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

#configPopup .button-container button,
#configPopup .checkbox-container label,
#notifConfigPopup .button-container button,
#notifConfigPopup .checkbox-container label {
  margin-bottom: 10px;
  flex-basis: 48%; /* Ajusté pour uniformiser l'apparence des boutons et des labels */
}

#configPopup button, #keyConfigPopup button, #favConfigPopup button, #notifConfigPopup button, #notePopup button, #advancedConfigPopup button {
  padding: 5px 10px;
  background-color: #f3f3f3;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
}

#configPopup button:not(.full-width), #keyConfigPopup button:not(.full-width), #favConfigPopup button:not(.full-width), #colorPickerPopup button:not(.full-width), #notifConfigPopup button:not(.full-width), #notePopup button:not(.full-width), #advancedConfigPopup button:not(.full-width) {
  margin-right: 1%;
  margin-left: 1%;
}

#configPopup button.full-width {
  flex-basis: 48%;
  margin-right: 1%;
  margin-left: 1%;
}

#configPopup button:hover {
  background-color: #e8e8e8;
}

#configPopup button:active {
  background-color: #ddd;
}
#configPopup label.disabled {
  color: #ccc;
}

#configPopup label.disabled input[type="checkbox"] {
  cursor: not-allowed;
}

#saveConfig, #closeConfig, #saveKeyConfig, #closeKeyConfig, #syncFavConfig, #saveFavConfig, #closeFavConfig, #saveColor, #closeColor, #saveNotifConfig, #closeNotifConfig, #saveNote, #closeNote, #saveAdvanced, #closeAdvanced, #restoreAdvancedConfig, #exportConfig, #importConfig, #deleteCustomTheme, #addCustomTheme {
  padding: 8px 15px !important; /* Plus de padding pour un meilleur visuel */
  margin-top !important: 5px;
  border-radius: 5px !important; /* Bordures légèrement arrondies */
  font-weight: bold !important; /* Texte en gras */
  border: none !important; /* Supprime la bordure par défaut */
  color: white !important; /* Texte en blanc */
  cursor: pointer !important;
  transition: background-color 0.3s ease !important; /* Transition pour l'effet au survol */
}

#deleteCustomTheme, #addCustomTheme {
  padding: 5px 8px !important; /* Plus de padding pour un meilleur visuel */
  margin-top !important: 5px;
  border-radius: 5px !important; /* Bordures légèrement arrondies */
  font-weight: bold !important; /* Texte en gras */
  border: none !important; /* Supprime la bordure par défaut */
  color: white !important; /* Texte en blanc */
  cursor: pointer !important;
  transition: background-color 0.3s ease !important; /* Transition pour l'effet au survol */
}

#saveConfig, #saveKeyConfig, #saveFavConfig, #saveColor, #saveNotifConfig, #saveNote, #saveAdvanced, #addCustomTheme {
  background-color: #4CAF50 !important; /* Vert pour le bouton "Enregistrer" */
}

#syncFavConfig, #restoreAdvancedConfig {
  background-color: #2196F3 !important; /* Bleu pour le bouton "Synchroniser" */
}

#closeConfig, #closeKeyConfig, #closeFavConfig, #closeColor, #closeNotifConfig, #closeNote, #closeAdvanced, #deleteCustomTheme {
  background-color: #f44336 !important; /* Rouge pour le bouton "Fermer" */
}

#saveConfig:hover, #saveKeyConfig:hover, #saveFavConfig:hover, #saveColor:hover, #saveNotifConfig:hover, #saveNote:hover, #saveAdvanced:hover, #saveAdvanced:hover, #addCustomTheme:hover {
  background-color: #45a049 !important; /* Assombrit le vert au survol */
}

#syncFavConfig:hover, #restoreAdvancedConfig:hover {
  background-color: #1976D2 !important;
}

#exportConfig, #importConfig {
  background-color: #0D47A1 !important;
}

#exportConfig:hover, #importConfig:hover {
  background-color: #002171 !important;
}

#syncFavConfig:disabled {
  background-color: #B0BEC5; /* Couleur grise pour le bouton désactivé */
  color: #FFFFFF; /* Couleur du texte, si nécessaire */
  cursor: not-allowed !important; /* Change le curseur pour indiquer que le bouton est désactivé */
  opacity: 0.6; /* Optionnel : rend le bouton semi-transparent */
}

#closeConfig:hover, #closeKeyConfig:hover, #closeFavConfig:hover, #closeColor:hover, #closeNotifConfig:hover, #closeNote:hover, #closeAdvanced:hover, #closeAdvanced:hover, #deleteCustomTheme:hover {
  background-color: #e53935 !important; /* Assombrit le rouge au survol */
}
#saveKeyConfig, #closeKeyConfig, #syncFavConfig, #saveFavConfig, #closeFavConfig, #saveColor, #closeColor, #saveNotifConfig, #closeNotifConfig, #saveNote, #closeNote, #saveAdvanced, #closeAdvanced, #restoreAdvancedConfig {
  margin-top: 10px; /* Ajoute un espace de 10px au-dessus du second bouton */
  width: 100%; /* Utilise width: 100% pour assurer que le bouton prend toute la largeur */
}
/*Pour un bouton seul sur une ligne
#configurerNotif {
  flex-basis: 100% !important; /* Prend la pleine largeur pour forcer à aller sur une nouvelle ligne */
  margin-right: 1% !important; /* Annuler la marge droite si elle est définie ailleurs */
  margin-left: 1% !important; /* Annuler la marge droite si elle est définie ailleurs */
}*/

/*Alignement des listes de thèmes*/
.flex-container {
  display: flex;
  gap: 20px;
}
.flex-item {
  flex: 1;
}

/*Bouton de filtre*/
.bouton-filtre, .bouton-share {
  background-color: #f0f0f0;
  border: 1px solid #dcdcdc;
  border-radius: 20px;
  padding: 5px 15px;
  margin-right: 5px;
  cursor: pointer;
  outline: none;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  color: #333;
  text-decoration: none;
  display: inline-block;
}

.bouton-filtre:not(.active):hover {
  background-color: #e8e8e8;
}

.bouton-filtre.active {
  background-color: #007bff;
  color: white;
}

.button-container.action-buttons > button,
.button-container.action-buttons > select.btn-like {
  flex-basis: 48%;
  margin-right: 1%;
  margin-left: 1%;
  margin-bottom: 10px;
  min-width: 0;
}



/* select de restauration */
select.btn-like {
  padding: 8px 12px;
  cursor: pointer;
  text-align: left;
}
`;
            document.head.appendChild(styleMenu);
            //Assurez-vous que les boutons sont toujours accessibles
            function adjustPopupLayout() {
                const popup = document.getElementById('configPopup');
                if (popup) {
                    const rect = popup.getBoundingClientRect();
                    if (rect.bottom > window.innerHeight) {
                        popup.style.top = `${window.innerHeight - rect.height}px`;
                    }
                }
            }

            window.addEventListener('resize', adjustPopupLayout); //Ajuster la position lors du redimensionnement de la fenêtre
            //Fonction pour rendre la fenêtre déplaçable
            function dragElement(elmnt) {
                var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
                if (document.getElementById(elmnt.id + "Header")) {
                    //si présent, le header est l'endroit où vous pouvez déplacer la DIV:
                    document.getElementById(elmnt.id + "Header").onmousedown = dragMouseDown;
                } else {
                    //sinon, déplace la DIV de n'importe quel endroit à l'intérieur de la DIV:
                    elmnt.onmousedown = dragMouseDown;
                }

                function dragMouseDown(e) {
                    e = e || window.event;
                    e.preventDefault();
                    //position de la souris au démarrage:
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    //appelle la fonction chaque fois que le curseur bouge:
                    document.onmousemove = elementDrag;
                }

                function elementDrag(e) {
                    e = e || window.event;
                    e.preventDefault();
                    //calcule la nouvelle position de la souris:
                    pos1 = pos3 - e.clientX;
                    pos2 = pos4 - e.clientY;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    //définit la nouvelle position de l'élément:
                    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
                    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
                }

                function closeDragElement() {
                    //arrête le mouvement quand le bouton de la souris est relâché:
                    document.onmouseup = null;
                    document.onmousemove = null;
                }
            }

            //Fonction pour calculer la taille de localStorage en Mo
            function calculerTailleLocalStorageEnMo() {
                let tailleTotale = 0;

                //Parcours de toutes les clés du localStorage
                for (let i = 0; i < localStorage.length; i++) {
                    let key = localStorage.key(i);
                    let valeur = localStorage.getItem(key);

                    //Ajoute la taille de la clé et de la valeur (en octets)
                    tailleTotale += key.length + valeur.length;
                }

                //Convertit la taille totale en Mo (1 Mo = 1024 * 1024 octets)
                return (tailleTotale / (1024 * 1024)).toFixed(2); //Limité à 2 décimales
            }

            //Fonction pour obtenir l'affichage de la mémoire avec couleur
            function afficherMemoireLocalStorage() {
                const tailleMaximale = 5; //5 Mo de capacité maximale pour la plupart des navigateurs
                const tailleActuelle = parseFloat(calculerTailleLocalStorageEnMo());
                let utilisation = (tailleActuelle / tailleMaximale) * 100;

                //Limite le pourcentage à 100%
                if (utilisation > 100) {
                    utilisation = 100;
                }

                let couleur;
                if (colorblindEnabled) {
                    //Palette accessible pour daltoniens
                    if (utilisation < 50) {
                        couleur = '#A6D854'; //Vert clair/turquoise (facilement distinguable)
                    } else if (utilisation <= 90) {
                        couleur = '#FFD92F'; //Jaune vif
                    } else {
                        couleur = '#E78AC3'; //Rose/magenta (très visible même en daltonisme rouge-vert)
                    }
                } else {
                    //Moins de 50% utilisé, affichage en vert
                    if (utilisation < 50) {
                        couleur = '#008000'; //Vert
                        //Entre 50% et 90%, affichage en bleu
                    } else if (utilisation <= 90) {
                        couleur = '#007FFF'; //Bleu
                        //Plus de 90%, affichage en rouge
                    } else {
                        couleur = '#FF0000'; //Rouge
                    }
                }

                //Chaîne avec la taille utilisée et la taille maximale
                let affichage = `(utilisation : <span style="color:${couleur};">${tailleActuelle} Mo (${utilisation.toFixed(2)}%)</span>)`;

                //Retourner le texte centré
                //return `<div style="text-align: center;">${affichage}</div>`;
                return affichage;
            }

            //Affichage de l'utilisation mémoire
            function afficherTailleLocalStorageParCategorie() {
                const categories = {
                    'Produits cachés': 0,
                    'Produits favoris': 0,
                    'Commandes': 0,
                    'Avis sauvegardés': 0,
                    'Modèles d\'avis': 0,
                    'Autres': 0
                };

                const quotaMaxMo = 5;
                const facteur = 1024 * 1024;

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    const valeur = localStorage.getItem(key);
                    const taille = key.length + valeur.length;

                    if (/_c$|_cache$/.test(key)) {
                        categories['Produits cachés'] += taille;
                    } else if (/_f$|_favori$/.test(key)) {
                        categories['Produits favoris'] += taille;
                    } else if (key.startsWith('order_')) {
                        categories['Commandes'] += taille;
                    } else if (key.startsWith('review_') && key !== 'review_templates') {
                        categories['Avis sauvegardés'] += taille;
                    } else if (key === 'review_templates') {
                        categories['Modèles d\'avis'] += taille;
                    } else {
                        categories['Autres'] += taille;
                    }
                }

                const ordreAffichage = [
                    'Produits cachés',
                    'Produits favoris',
                    'Commandes',
                    'Avis sauvegardés',
                    'Modèles d\'avis',
                    'Autres'
                ];

                const messageLignes = [];
                let totalOctets = Object.values(categories).reduce((a, b) => a + b, 0);

                messageLignes.push(`Utilisation de la mémoire (quota max estimatif : ${quotaMaxMo} Mo) :\n`);

                for (let cat of ordreAffichage) {
                    const tailleMo = categories[cat] / facteur;
                    const pourcentage = (tailleMo / quotaMaxMo) * 100;

                    const tailleAffichee = (tailleMo > 0 && tailleMo < 0.01)
                    ? tailleMo.toFixed(4)
                    : tailleMo.toFixed(2);

                    messageLignes.push(`${cat} : ${tailleAffichee} Mo (${pourcentage.toFixed(1)}%)`);
                }

                const totalMo = totalOctets / facteur;
                const pourcentageTotal = (totalMo / quotaMaxMo) * 100;

                messageLignes.push(`\nTotal utilisé : ${totalMo.toFixed(2)} Mo (${pourcentageTotal.toFixed(1)}%)`);

                alert(messageLignes.join('\n'));
            }

            //Crée la fenêtre popup de configuration avec la fonction de déplacement
            async function createConfigPopup() {
                if (document.getElementById('configPopup')) {
                    return; //Termine la fonction pour éviter de créer une nouvelle popup
                }
                let isPremiumPlus = false;
                let isPremium = false;
                let isPlus = false;
                let isReco = false;
                let dateLastSave = false;
                const responsePremiumPlus = await verifyTokenPremiumPlus(API_TOKEN);
                const responsePremium = await verifyTokenPremium(API_TOKEN);
                const responsePlus = await verifyTokenPlus(API_TOKEN);
                const responseReco = await verifyTokenReco(API_TOKEN);
                let apiToken = "";
                if (API_TOKEN == undefined) {
                    apiToken = "";
                } else {
                    isPremiumPlus = responsePremiumPlus && responsePremiumPlus.status === 200;
                    isPremium = responsePremium && responsePremium.status === 200;
                    isPlus = responsePlus && responsePlus.status === 200;
                    isReco = responseReco && responseReco.status === 200;
                    apiToken = API_TOKEN;
                    if (isPremium) {
                        dateLastSave = await lastSave();
                    }
                }
                //Style pour les deux listes déroulantes l'une a coté de l'autre
                const style = document.createElement('style');
                style.innerHTML = `
  .flex-container-theme {
    display: flex;
    gap: 10px;
  }
  .flex-item-theme {
    flex: 1;
  }
  .button-container.action-buttons button[disabled] {
    cursor: not-allowed !important;  /* Curseur spécifique pour indiquer que le bouton est désactivé */
  }

  .button-container.action-buttons button[disabled]:hover {
    cursor: not-allowed !important;  /* Le curseur reste le même */
  }
`;
                document.head.appendChild(style);
                document.body.classList.add('modal-open');

                const popup = document.createElement('div');
                popup.id = "configPopup";
                popup.innerHTML = `
    <h2 id="configPopupHeader">
  <span style="color: #0463d5;">Paramètres</span>
  <span style="color: #f9a13b;">PickMe</span>
  <span style="color: #0463d5;">v${version}</span>
  <span id="closePopup" style="float: right; cursor: pointer;">&times;</span>
</h2>
    <div style="text-align: center; margin-bottom: 20px;">
        <p id="links-container" style="text-align: center;">
            <a href="${baseUrlPickme}/wiki/doku.php?id=plugins:pickme" target="_blank">
                <img src="${baseUrlPickme}/img/wiki.png" alt="Wiki" style="vertical-align: middle; margin-right: 5px; width: 25px; height: 25px;">
                Wiki
            </a>
            ${mobileEnabled ? '<br>' : '<span id="separator"> | </span>'}
            <a href="${baseUrlPickme}/wiki/doku.php?id=vine:comment_nous_aider_gratuitement" target="_blank">
                <img src="${baseUrlPickme}/img/soutiens.png" alt="Soutenir gratuitement" style="vertical-align: middle; margin-right: 5px; width: 25px; height: 25px;">
                Soutenir gratuitement
            </a>
        </p>
    </div>
    <div class="checkbox-container">
      ${createCheckbox('highlightEnabled', 'Surbrillance des nouveaux produits', 'Permet d\'ajouter un fond de couleur dès qu\'un nouveau produit est trouvé sur la page en cours. La couleur peut se choisir avec le bouton plus bas dans ces options.')}
      ${createCheckbox('firsthlEnabled', 'Mettre les nouveaux produits en début de page', 'Les nouveaux produits seront mis au tout début de la liste des produits sur la page en cours.')}
      ${createCheckbox('paginationEnabled', 'Affichage des pages en partie haute', 'En plus des pages de navigation en partie basse, ajoute également la navigation des pages en début de liste des produits.')}
      ${createCheckbox('hideEnabled', 'Pouvoir cacher des produits et ajouter des favoris', 'Ajoute l\'option qui permet de cacher certains produits de votre choix ainsi que des favoris (le produit devient impossible à cacher et sera toujours mis en tête en liste sur la page), ainsi que les boutons pour tout cacher ou tout afficher en une seule fois.')}
      ${createCheckbox('cssEnabled', 'Utiliser l\'affichage réduit', 'Affichage réduit, pour voir plus de produits en même temps, avec également réduction de la taille des catégories. Option utile sur mobile par exemple. Non compatible avec l\'affichage du nom complet des produits et l\'affichage mobile.')}
      ${createCheckbox('mobileEnabled', 'Utiliser l\'affichage mobile', 'Optimise l\affichage sur mobile, pour éviter de mettre la "Version PC". Il est conseillé de cacher également l\'entête avec cette option. Non compatible avec l\'affichage du nom complet des produits et l\'affichage réduit.')}
      ${createCheckbox('headerEnabled', 'Cacher totalement l\'entête de la page', 'Cache le haut de la page Amazon, celle avec la zone de recherche et les menus.')}
      ${createCheckbox('extendedEnabled', 'Afficher le nom complet des produits', 'Affiche 4 lignes, si elles existent, au nom des produits au lieu de 2 en temps normal. Non compatible avec l\'affichage alternatif.')}
      ${createCheckbox('wheelfixEnabled', 'Corriger le chargement infini des produits', 'Corrige le bug quand un produit ne charge pas (la petite roue qui tourne sans fin). Attention, même si le risque est très faible, on modifie une information transmise à Amazon, ce qui n\'est pas avec un risque de 0%.')}
      ${createCheckbox('fullloadEnabled', 'N\'afficher la page qu\'après son chargement complet', 'Attend le chargement complet des modifications de PickMe avant d\'afficher la page. Cela peut donner la sensation d\'un chargement plus lent de la page mais évite de voir les produits cachés de façon succincte ou le logo Amazon par exemple.')}
      ${createCheckbox('autohideEnabled', 'Utiliser le filtre par mots-clés', 'Permet de cacher automatiquement des produits selon des mots clés, ou au contraire d\'en mettre en avant. La configuration se fait via le bouton "Configurer les mots-clés pour le filtre". Peut ajouter de la latence au chargement de la page, surtout si l\'option "N\'afficher la page qu\'après son chargement complet" est activée.')}
      ${createCheckbox('ordersEnabled', 'Afficher code erreur/Envoyer mes commandes', 'Afficher un code erreur quand une commande ne passe pas. Attention, cela envoi également vos commandes sur le serveur pour le besoin de certaines fonctions (comme pouvoir voir le prix par mois/année de vos commandes sur le discord).')}
      ${isPlus ? createCheckbox('fastCmd', '(Admin) Ajouter un bouton de "Commande rapide"', 'Ajoute un bouton sur tous les produits pour commander en un clic. Si le produit à des variantes, la première variante sera choisi. L\'adresse de livraison sera celle du menu déroulant plus bas.') : ''}
      ${isPlus ? createCheckbox('ordersPercent', '(Admin) Afficher le % de commandes', '') : ''}
      ${createCheckbox('fastCmdEnabled', '(PC) Accélérer le processus de commandes', 'Met le focus sur le bouton pour commander (il suffira donc de faire "Entrée" pour valider) et agrandir la fenêtre contenant les adresses, ce qui alignera les boutons de validation des deux fenêtres si vous souhaitez cliquer.')}
      ${createCheckbox('autoRefresh', '(PC) Auto-refresh', 'Ajoute un menu pour configurer un auto-refresh. Le menu comprend un bouton d\'activation, la page à rafraichir, un délai de rafraichissement, un délai aléatoire maximum en secondes qui sera ajouté au délai de rafraichissement (par exemple si je choisis 15 en aléatoire, alors on va ajouter en 1 et 15 secondes au délai) et un refresh horaire (à heure fixe pour les recos principalement). Incompatible sur mobile.')}
      ${createCheckbox('notifEnabled', '(Premium) Activer les notifications', 'Affiche une notification lors du signalement d\'un nouvel objet "Disponible pour tous", un up ou autre selon la configuration. Ne fonctionne que si une page Amazon était active dans les dernières secondes ou si le centre de notifications est ouvert en Auto-refresh de moins de 30 secondes.',!isPremium)}
      ${createCheckbox('sendReco', '(Premium) À chaque nouvelle recommandation recevoir le produit en message privé sur discord','Attention, si vous activez cette option, vos recommandations seront stockées sur le serveur distant, même si aucun usage autre que l\'option n\'en sera fait. Contrairement aux autres options, le fait qu\'elle soit activée ou non est centralisé sur le serveur et non local.', !isPremium, isReco)}
      ${createCheckbox('ordersInfos', '(Premium) Afficher l\'ETV et les informations de la communauté sur les commandes','Affiche l\'ETV du produit, le nombre de variantes, le drapeau d\'origine du vendeur et s\'il est limité (si info disponible) ainsi que le nombre de personnes ayant pu commander ou non le produit (rond vert : commande réussie, rond rouge : commande en erreur).', !isPremium)}
      ${createCheckbox('flagEnabled', '(Premium) Afficher le drapeau montrant l\'origine du vendeur','Un drapeau est ajouté sur le bouton des détails pour informer du pays d\'origine du produit.', !isPremium)}
      ${createCheckbox('statsEnabled', '(Premium+) Afficher les statistiques produits','Affiche la quantité de produits ajoutés ce jour et dans le mois à côté des catégories.', !isPremiumPlus)}
      ${createCheckbox('ordersStatsEnabled', '(Premium+) Afficher le nombre de commandes du jour/mois','Affiche le nombre de commandes passées sur la journée et le mois en cours.', !isPremiumPlus)}
    </div>
     <div class="api-token-container">
      <label for="apiTokenInput">Clé API :</label>
      <input type="text" id="apiTokenInput" value="${apiToken}" style="width: 100%; max-width: 480px; margin-bottom: 10px;" />
      <div class="flex-container-theme">
    <div class="theme-container flex-item-theme">
      <label for="themeSelect">Thème :</label>
      <select id="themeSelect" style="width: 100%; max-width: 480px; margin-bottom: 10px; height: 31px;">
        <option value="default">Clair (défaut)</option>
        <option value="dark">Sombre</option>
      </select>
    </div>
    <div class="button-color-container flex-item-theme">
      <label for="buttonColorSelect">Boutons :</label>
      <select id="buttonColorSelect" style="width: 100%; max-width: 480px; margin-bottom: 10px; height: 31px;">
        <option value="default">Défaut</option>
        <option value="black">Noir</option>
        <option value="blue">Bleu</option>
        <option value="pink">Rose</option>
        <option value="purple">Violet</option>
        <option value="red">Rouge</option>
        <option value="green">Vert</option>
        <option value="orange">Orange</option>
      </select>
    </div>
    </div>
    <div class="tab-container flex-item-theme" style="width: 100%;">
      <label for="tabSelect">Onglet par défaut :</label>
      <select id="tabSelect" style="width: 100%; margin-bottom: 10px; height: 31px;">
        <option value="RFY">Recommandé pour vous</option>
        <option value="AFA">Disponible pour tous</option>
        <option value="AI">Autres articles</option>
        <option value="ALL">Tous les articles</option>
      </select>
    </div>
${isPlus && apiOk ? `
  <div class="address-selector-container flex-item-theme" style="width: 100%;">
    <label for="address-selector">Adresse pour la commande rapide :</label>
    <select id="address-selector" style="width: 100%; margin-bottom: 10px; height: 31px;">
    </select>
  </div>
` : ''}
    ${addActionButtons(!isPremium, !isPremiumPlus, dateLastSave)}
  `;
                document.body.appendChild(popup);

                //Créer la liste déroulante des adresses
                if (isPlus && apiOk) {
                    createAddress();
                    document.getElementById('fastCmd').addEventListener('change', function() {
                        if (this.checked) {
                            varFastCmd();
                        } else {
                            GM_deleteValue('fastCmdVar');
                        }
                    });
                } else {
                    GM_setValue('fastCmd', false);
                    GM_setValue('ordersPercent', false);
                    GM_deleteValue('fastCmdVar');
                }

                //Initialiser le thème et choisir celui qui est actif dans la liste
                document.getElementById('themeSelect').value = savedTheme;

                //Initialiser la couleur des boutons et choisir celle qui est active dans la liste
                document.getElementById('buttonColorSelect').value = savedButtonColor;

                document.getElementById('tabSelect').value = defautTab;

                document.getElementById('cssEnabled').addEventListener('change', function() {
                    if (this.checked) {
                        document.getElementById('mobileEnabled').checked = false;
                    }
                });

                if (document.getElementById('cssEnabled').checked || document.getElementById('fastCmdEnabled').checked || document.getElementById('autoRefresh').checked) {
                    document.getElementById('mobileEnabled').checked = false;
                }

                document.getElementById('mobileEnabled').addEventListener('change', function() {
                    if (this.checked) {
                        document.getElementById('cssEnabled').checked = false;
                        document.getElementById('fastCmdEnabled').checked = false;
                        document.getElementById('autoRefresh').checked = false;
                    }
                });

                document.getElementById('fastCmdEnabled').addEventListener('change', function() {
                    if (this.checked) {
                        document.getElementById('mobileEnabled').checked = false;
                    }
                });

                document.getElementById('autoRefresh').addEventListener('change', function() {
                    if (this.checked) {
                        document.getElementById('mobileEnabled').checked = false;
                        alert("Attention : si vous configurez un délai trop court pour cette option, cela comporte un risque de ban par Amazon.\nÉvitez les délais inférieurs à 2 ou 3 minutes et ne mettez pas un délai aléatoire trop faible (moins de 10 secondes).");
                    }
                });

                document.getElementById('hideEnabled').addEventListener('change', function() {
                    if (this.checked) {
                        hideBas = window.confirm("Ajouter des boutons en bas de page pour rendre visibles ou cacher (en plus de ceux en haut de page) ?");
                        GM_setValue('hideBas', hideBas);
                    }
                });

                document.getElementById('ordersInfos').addEventListener('change', function() {
                    if (this.checked) {
                        statsInReviews = window.confirm("Afficher également les informations de la communauté sur les commandes dans les avis ?");
                        GM_setValue('statsInReviews', statsInReviews);
                    }
                });

                document.getElementById('notifEnabled').addEventListener('change', function() {
                    if (this.checked) {
                        document.getElementById('configurerNotif').disabled = false;
                        //Demander à l'utilisateur s'il est sur mobile ou PC
                        onMobile = window.confirm("Êtes-vous sur un appareil mobile ?");

                        GM_setValue('onMobile', onMobile);

                        //Demander à l'utilisateur s'il est sur mobile ou PC
                        shortcutNotif = window.confirm("Souhaitez-vous ajouter un raccourci vers le centre de notifications  ?");

                        GM_setValue('shortcutNotif', shortcutNotif);
                    } else {
                        document.getElementById('configurerNotif').disabled = true;
                    }
                });

                document.getElementById('ordersStatsEnabled').addEventListener('change', function() {
                    var ordersEnabledCheckbox = document.getElementById('ordersEnabled');
                    if (this.checked) {
                        ordersEnabledCheckbox.checked = true;
                        ordersEnabledCheckbox.disabled = true;
                    } else {
                        ordersEnabledCheckbox.disabled = false;
                    }
                });

                document.getElementById('flagEnabled').addEventListener('change', function() {
                    var ordersInfosCheckbox = document.getElementById('ordersInfos');
                    if (this.checked) {
                        ordersInfosCheckbox.checked = true;
                        ordersInfosCheckbox.disabled = true;
                    } else {
                        ordersInfosCheckbox.disabled = false;
                    }
                });

                /*document.getElementById('autohideEnabled').addEventListener('change', function() {
                if (this.checked) {
                    document.getElementById('configurerFiltres').disabled = false;
                } else {
                    document.getElementById('configurerFiltres').disabled = true;
                }
            });*/

                function handleOrdersCheckboxes() {
                    var ordersEnabledCheckbox = document.getElementById('ordersEnabled');
                    var ordersStatsEnabledCheckbox = document.getElementById('ordersStatsEnabled');
                    var ordersInfosCheckbox = document.getElementById('ordersInfos');
                    var flagEnabledCheckbox = document.getElementById('flagEnabled');

                    if (ordersStatsEnabledCheckbox.checked || ordersInfosCheckbox.checked || flagEnabledCheckbox.checked) {
                        ordersEnabledCheckbox.checked = true;
                        ordersEnabledCheckbox.disabled = true;
                    } else {
                        ordersEnabledCheckbox.disabled = false;
                    }
                    if (flagEnabledCheckbox.checked) {
                        ordersInfosCheckbox.checked = true;
                        ordersInfosCheckbox.disabled = true;
                    }
                }

                document.getElementById('ordersStatsEnabled').addEventListener('change', handleOrdersCheckboxes);
                document.getElementById('ordersInfos').addEventListener('change', handleOrdersCheckboxes);
                document.getElementById('flagEnabled').addEventListener('change', handleOrdersCheckboxes);

                //Initialiser l'état des cases à cocher au chargement de la page
                handleOrdersCheckboxes();

                document.getElementById('closePopup').addEventListener('click', () => {
                    document.body.classList.remove('modal-open');
                    document.getElementById('configPopup').remove();
                });

                //Ajoute des écouteurs pour les nouveaux boutons
                document.getElementById('configurerNotif').addEventListener('click', configurerNotif);
                document.getElementById('configurerTouches').addEventListener('click', function() {
                    configurerTouches(isPremium);
                });
                document.getElementById('configurerFiltres').addEventListener('click', configurerFiltres);
                document.getElementById('configurerAdvanced').addEventListener('click', function() {
                    configurerAdvanced(isPremium);
                });
                document.getElementById('setHighlightColor').addEventListener('click', setHighlightColor);
                document.getElementById('setHighlightColorFav').addEventListener('click', setHighlightColorFav);
                document.getElementById('createConfigPopupRR').addEventListener('click', createConfigPopupRR);
                document.getElementById('syncProducts').addEventListener('click', syncProducts);
                document.getElementById('saveData').addEventListener('click', () => {
                    if (confirm("Êtes-vous sûr de vouloir sauvegarder les paramètres ? Cela supprimera la sauvegarde actuelle (s'il y en a une)")) {
                        saveData();
                    }
                });

                document.getElementById('restoreData').addEventListener('click', async () => {
                    const type = document.getElementById('restoreDataSelect').value; //all|settings|favhide|products|RRsettings|orders
                    const labels = {
                        all: "toutes les données",
                        settings: "les paramètres PickMe",
                        favhide: "les produits favoris/cachés",
                        products: "les temps/découverte produits",
                        orders: "les commandes",
                        RRsettings: "les paramètres ReviewRemember"
                    };

                    if (confirm(`Êtes-vous sûr de vouloir restaurer ${labels[type]} ?`)) {
                        await restoreData(type);
                        popup.remove();
                        const cleanedLabel = labels[type].replace(/^\s*les\s+/i, '');
                        console.log(`[PïckMe] Restauration réussie (${cleanedLabel})`);
                        alert(`Restauration réussie (${cleanedLabel})`);
                        window.location.reload();
                    }
                });

                document.getElementById('purgeStoredProducts').addEventListener('click', () => {
                    if (confirm("Êtes-vous sûr de vouloir supprimer les produits enregistrés pour la surbrillance ?")) {
                        purgeStoredProducts(true);
                    }
                    alert("Tous les produits ont été supprimés.");
                });

                document.getElementById('purgeHiddenObjects').addEventListener('click', () => {
                    purgeHiddenObjects(true);
                });

                document.getElementById('purgeAllItems').addEventListener('click', () => {
                    purgeAllItems();
                });

                document.getElementById('purgeDetails').addEventListener('click', () => {
                    afficherTailleLocalStorageParCategorie();
                });

                dragElement(popup);

                document.getElementById('saveConfig').addEventListener('click', saveConfig);
                document.getElementById('closeConfig').addEventListener('click', () => {
                    //Retire la classe "modal-open" du body
                    document.body.classList.remove('modal-open');
                    popup.remove();
                });

            }

            function createCheckbox(name, label, explanation = null, disabled = false, toCheck = false) {
                const isChecked = !disabled && (name === 'sendReco' ? toCheck : GM_getValue(name, false)) ? 'checked' : '';
                const isDisabled = disabled ? 'disabled' : '';
                const color = 'gray';

                const helpSpanId = `help-span-${name}`;

                const helpIcon = explanation
                ? `<span id="${helpSpanId}" style="cursor: help; color: ${color}; font-size: 16px;">?</span>`
                : '';

                const checkboxHtml = `<label class="${isDisabled ? 'disabled' : ''}" style="display: flex; align-items: flex-start;">
        <div style="flex: 1;">
            <input type="checkbox" id="${name}" name="${name}" ${isChecked} ${isDisabled}>
            ${label}
        </div>
        ${helpIcon ? `<div style="width: 20px; text-align: center;">${helpIcon}</div>` : ''}
    </label>`;

                setTimeout(() => {
                    const helpSpan = document.getElementById(helpSpanId);
                    if (helpSpan) {
                        helpSpan.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            alert(explanation);
                        });
                    }
                }, 0);

                return checkboxHtml;
            }

            //Création de la liste des adresses
            function createAddress() {
                //Sélectionnez tous les éléments contenant les adresses
                const addressOptions = document.querySelectorAll('.vvp-address-option');

                //Sélectionnez la liste déroulante dans laquelle vous voulez insérer les adresses
                const addressSelector = document.getElementById('address-selector');

                //Récupérer l'adresse sauvegardée dans GM
                const savedAddress = GM_getValue('savedAddress', null);

                //Vérifiez que l'élément addressSelector existe
                if (addressSelector) {
                    //Pour chaque option d'adresse trouvée
                    addressOptions.forEach(option => {
                        //Récupérez l'adresse
                        const addressLabel = option.querySelector('.a-label').innerText.trim();
                        const addressValue = option.querySelector('input[type="radio"]').value;
                        const addressId = option.getAttribute('data-address-id');
                        const legacyAddressId = option.getAttribute('data-legacy-address-id');

                        //Créez une nouvelle option pour la liste déroulante
                        const newOption = document.createElement('option');
                        newOption.value = addressValue;
                        newOption.textContent = addressLabel;

                        //Ajoutez les data-attributes pour pouvoir les récupérer plus tard
                        newOption.setAttribute('data-address-id', addressId);
                        newOption.setAttribute('data-legacy-address-id', legacyAddressId);

                        //Si l'adresse actuelle est celle qui est sauvegardée, la sélectionner
                        if (savedAddress && addressId === savedAddress.addressId) {
                            newOption.selected = true;
                        }

                        //Ajoutez la nouvelle option à la liste déroulante
                        addressSelector.appendChild(newOption);
                    });

                    //Ajout d'un événement pour sauvegarder l'adresse sélectionnée a chaque changement au lieu du bouton sauvegarder
                    //addressSelector.addEventListener('change', saveAddress);

                } else {
                    console.error('L\'élément address-selector est introuvable.');
                }
            }

            //Fonction pour sauvegarder l'adresse
            function saveAddress() {
                const addressSelector = document.getElementById('address-selector');
                if (addressSelector) {
                    const selectedOption = addressSelector.options[addressSelector.selectedIndex];

                    const selectedAddress = {
                        label: selectedOption.textContent,
                        value: selectedOption.value,
                        addressId: selectedOption.getAttribute('data-address-id'),
                        legacyAddressId: selectedOption.getAttribute('data-legacy-address-id')
                    };

                    //Sauvegarde de l'adresse sélectionnée dans GM
                    GM_setValue('savedAddress', selectedAddress);
                }
            }

            //Sauvegarde la configuration
            async function saveConfig() {
                document.querySelectorAll('#configPopup input[type="checkbox"]').forEach(input => {
                    if (input.name == "sendReco") {
                        const newReco = input.checked ? 1 : 0;
                        switchReco(API_TOKEN, newReco)
                    } else {
                        GM_setValue(input.name, input.checked);
                    }
                });
                const newApiToken = document.getElementById('apiTokenInput').value;
                var response = await verifyToken(newApiToken);
                if (response && response.status === 200) {
                    //Sauvegarde de la clé après validation du serveur
                    GM_setValue('apiToken', newApiToken);
                } else if (response && response.status === 404) {
                    GM_deleteValue("apiToken");
                    alert("Clé API invalide !");
                    return
                }
                //Enregistrer le thème sélectionné
                const selectedTheme = document.getElementById('themeSelect').value;
                GM_setValue('selectedTheme', selectedTheme);

                //Enregistrer la couleur des boutons sélectionnée
                const selectedButtonColor = document.getElementById('buttonColorSelect').value;
                GM_setValue('selectedButtonColor', selectedButtonColor);

                //Enregistrer l'onglet par défaut
                const defautTab = document.getElementById('tabSelect').value;
                GM_setValue('defautTab', defautTab);

                //Sauvegarde de l'adresse
                saveAddress();

                //On recharge la page et on ferme le menu
                window.location.reload();
                document.getElementById('configPopup').remove();
            }

            //Ajoute les boutons pour les actions spécifiques qui ne sont pas juste des toggles on/off
            function addActionButtons(isPremium, isPremiumPlus, dateLastSave) {
                const noBackup = dateLastSave === "Aucune sauvegarde";
                //Exemple bouton qui prend toute la ligne : <button style="flex-basis: 100%;" id="createConfigPopupRR">Paramètres ReviewRemember</button>
                return `
<div class="button-container action-buttons">
  <button style="flex-basis: 100%;" id="createConfigPopupRR">Paramètres ReviewRemember</button>
  <button id="configurerAdvanced">Paramètres avancés</button>
  <button id="configurerFiltres">Configurer les mots-clés pour le filtre</button>
  <button id="setHighlightColor">Couleur de surbrillance des repop/nouveaux produits</button>
  <button id="setHighlightColorFav">Couleur de surbrillance des produits filtrés</button>
  <button id="syncProducts">Synchroniser les produits avec le serveur</button>
  <button id="configurerTouches">(PC) Configurer les raccourcis clavier</button>
  <button id="configurerNotif" ${isPremium || !notifEnabled ? 'disabled' : ''}>(Premium) Configurer les notifications</button>
  <button id="saveData" ${isPremium ? 'disabled' : ''}>(Premium) Sauvegarder les paramètres/produits${dateLastSave ? ' (' + dateLastSave + ')' : ''}</button>
  <button id="restoreData"
          ${isPremium || noBackup ? 'disabled' : ''}>
      (Premium) Restaurer :
  </button>

  <select id="restoreDataSelect"
          class="btn-like"
          ${isPremium || noBackup ? 'disabled' : ''}>
      <option value="all">Tout</option>
      <option value="settings">Paramètres PickMe</option>
      <option value="RRsettings">Paramètres ReviewRemember</option>
      <option value="orders">Commandes</option>
      <option value="favhide">(Produits) Favoris/Cachés</option>
      <option value="products">(Produits) Temps/Bandeau découverte</option>
  </select>
  <button id="purgeStoredProducts">Supprimer les produits enregistrés pour la surbrillance</button>
  <button id="purgeHiddenObjects">Supprimer les produits cachés et/ou les favoris</button>
  <button id="purgeAllItems">Purger la mémoire ${afficherMemoireLocalStorage()}</button>
  <button id="purgeDetails">Voir le détail de l'usage de la mémoire</button>
</div>
<div class="button-container final-buttons">
  <button class="full-width" id="saveConfig">Enregistrer</button>
  <button class="full-width" id="closeConfig">Fermer</button>
</div>
    `;
                document.getElementById('openConfigPopupRR')?.addEventListener('click', openConfigPopupRR);
            }

            //Ajouter la commande de menu "Paramètres"
            GM_registerMenuCommand("Paramètres PickMe", createConfigPopup, "p");

            //Fonction pour créer la fenêtre popup de configuration des touches
            function createKeyConfigPopup(isPremium) {
                //Vérifie si une popup existe déjà et la supprime si c'est le cas
                const existingPopup = document.getElementById('keyConfigPopup');
                if (existingPopup) {
                    existingPopup.remove();
                }

                //Crée la fenêtre popup
                const popup = document.createElement('div');
                popup.id = "keyConfigPopup";
                popup.style.cssText = `
        z-index: 10002;
        width: 350px;
    `;
                popup.innerHTML = `
        <h2 id="configPopupHeader">Configuration des touches<span id="closeKeyPopup" style="float: right; cursor: pointer;">&times;</span></h2>
        ${createKeyInput('keyLeft', 'Navigation à gauche (flêche : ArrowLeft)')}
        ${createKeyInput('keyRight', 'Navigation à droite (flêche : ArrowRight)')}
        ${createKeyInput('keyUp', 'Onglet suivant (flêche : ArrowUp)')}
        ${createKeyInput('keyDown', 'Onglet précédent (flêche : ArrowDown)')}
        ${createKeyInput('keyHide', 'Tout cacher')}
        ${createKeyInput('keyShow', 'Tout montrer')}
        ${createKeyInput('keySync', 'Synchroniser les produits avec le serveur et tout cacher')}
<div class="button-container final-buttons">
  <button class="full-width" id="saveKeyConfig">Enregistrer</button>
  <button class="full-width" id="closeKeyConfig">Fermer</button>
</div>
    `;

                document.body.appendChild(popup);
                //dragElement(popup); //Utilise ta fonction existante pour rendre la popup déplaçable

                //Ajout des écouteurs d'événements pour les boutons
                document.getElementById('saveKeyConfig').addEventListener('click', saveKeyConfig);
                document.getElementById('closeKeyConfig').addEventListener('click', () => document.getElementById('keyConfigPopup').remove());
                document.getElementById('closeKeyPopup').addEventListener('click', () => {
                    document.getElementById('keyConfigPopup').remove();
                });
            }

            //Crée les champs de saisie pour les touches
            function createKeyInput(id, label, disabled = false) {
                const value = GM_getValue(id, ''); //Récupère la valeur actuelle ou une chaîne vide par défaut
                const disabledAttribute = disabled ? 'disabled' : ''; //Détermine si l'attribut disabled doit être ajouté
                return `
        <div style="margin-top: 10px;">
            <label for="${id}" style="display: block;">${label}</label>
            <input type="text" id="${id}" name="${id}" value="${value}" style="width: 100%; box-sizing: border-box; padding: 8px; margin-top: 4px;" ${disabledAttribute}>
        </div>
    `;
            }

            //Fonction pour enregistrer la configuration des touches
            function saveKeyConfig() {
                const keys = ['keyLeft', 'keyRight', 'keyUp', 'keyDown', 'keyHide', 'keyShow', 'keySync'];
                keys.forEach(key => {
                    const inputValue = document.getElementById(key).value;
                    GM_setValue(key, inputValue);
                });
                document.getElementById('keyConfigPopup').remove();
            }

            //Fonction pour créer la fenêtre popup de configuration des notifications
            function createNotifConfigPopup() {
                //Vérifie si une popup existe déjà et la supprime si c'est le cas
                const existingPopup = document.getElementById('notifConfigPopup');
                if (existingPopup) {
                    existingPopup.remove();
                }

                //Crée la fenêtre popup
                const popup = document.createElement('div');
                popup.id = "notifConfigPopup";
                popup.style.cssText = `
        z-index: 10002;
        width: 500px;
    `;
                popup.innerHTML = `
    <h2>Configurer les notifications<span id="closeNotifPopup" style="float: right; cursor: pointer;">&times;</span></h2>
    <div class="checkbox-container">
    <u class="full-width"><b>Options :</u></b><br>
    ${createCheckbox('notifFav', 'Filtrer "Autres articles"/"Tous les articles"', 'Utilise les filtres (soit celui des favoris, soit celui pour exclure) pour ne remonter que les notifications favoris ou sans mots exclus et uniquement si c\'est un produit "Autres articles" ou "Tous les articles" (aucun filtre sur "Disponible pour tous"). La notification apparaitra tout de même dans le centre de notifications. Prend en compte le filtre, même si l\'option des filtres est désactivée')}
    ${createCheckbox('notifSound', 'Jouer un son', 'Permet de jouer un son à réception d\'une notification. Astuce : pour personnaliser le son, rendez-vous dans les paramètres avancées pour saisir l\'URL du mp3 (uniquement) de votre choix')}
    <select id="filterOptions" ${notifFav ? '' : 'disabled'} style="margin-bottom: 10px;">
       <option value="notifFavOnly" ${filterOption === 'notifFavOnly' ? 'selected' : ''}>Ne voir que les produits avec mots-clés</option>
       <option value="notifExcludeHidden" ${filterOption === 'notifExcludeHidden' ? 'selected' : ''}>Tout voir sauf mots exclus</option>
    </select>
    ${createCheckbox('onMobile', 'Version mobile')}
    ${createCheckbox('shortcutNotif', 'Raccourci vers le centre de notifications')}
    <u class="full-width"><b>Type de notifications :</u></b><br>
    ${createCheckbox('notifUp', 'Up (!up)', 'Recevoir une notification à chaque usage de la commande !up sur discord.')}
    ${createCheckbox('notifRecos', 'Recos (!reco)', 'Recevoir une notification à chaque usage de la commande !up sur discord.')}
    ${createCheckbox('notifRFY', 'Recommandé pour vous', "Recevoir une notification à chaque nouvelle recommandation personnelle. Ne fonctionne que si vous avez activé l'option '(Premium) À chaque nouvelle recommandation recevoir le produit en message privé sur discord'.")}
    ${createCheckbox('notifPartageAFA', 'Disponible pour tous', "Recevoir une notification à chaque partage d'un produit 'Disponible pour tous' via PickMe.")}
    ${createCheckbox('notifPartageAI', 'Autres articles', "Recevoir une notification à chaque partage d'un produit 'Autres articles' via PickMe.")}
    ${createCheckbox('notifPartageALL', 'Tous les articles', "Recevoir une notification à chaque partage d'un produit 'Tous les articles' via PickMe.")}
    ${createCheckbox('notifAutres', 'Divers', "Cela peut être une annonce, une information, un test, etc...")}
    </div>
    <div class="button-container">
      <button id="saveNotifConfig">Enregistrer</button>
      <button id="closeNotifConfig">Fermer</button>
    </div>
    `;

                document.body.appendChild(popup);
                //dragElement(popup); //Utilise ta fonction existante pour rendre la popup déplaçable

                document.getElementById('notifFav').addEventListener('change', function() {
                    document.getElementById('filterOptions').disabled = !this.checked;
                });

                //Ajout des écouteurs d'événements pour les boutons
                document.getElementById('closeNotifPopup').addEventListener('click', function() {
                    popup.remove();
                });
                document.getElementById('saveNotifConfig').addEventListener('click', saveNotifConfig);
                document.getElementById('closeNotifConfig').addEventListener('click', function() {
                    popup.remove();
                });
            }


            function saveNotifConfig() {
                document.querySelectorAll('#notifConfigPopup input[type="checkbox"]').forEach(input => {
                    GM_setValue(input.name, input.checked);
                    if (input.name == "notifFav") {
                        notifFav = input.checked;
                    }
                });
                filterOption = document.getElementById('filterOptions').value;
                GM_setValue('filterOption', document.getElementById('filterOptions').value);
                document.getElementById('notifConfigPopup').remove(); //Ferme la popup après enregistrement
            }

            //Fonction pour créer la fenêtre popup de configuration des filtres
            async function createFavConfigPopup() {
                //Vérifie si une popup existe déjà et la supprime si c'est le cas
                const existingPopup = document.getElementById('favConfigPopup');
                if (existingPopup) {
                    existingPopup.remove();
                }
                let isRole = false;
                const responseRole = await verifyTokenRole(API_TOKEN);
                isRole = responseRole && responseRole.status === 200;
                //Crée la fenêtre popup
                const popup = document.createElement('div');
                popup.id = "favConfigPopup";
                popup.style.cssText = `
        z-index: 10002;
        width: 600px;
    `;
                popup.innerHTML = `
        <h2 id="configPopupHeader">Configuration des mots-clés<span id="closeFavPopup" style="float: right; cursor: pointer;">&times;</span></h2>
        <div>
            <label for="favWords">Produits à mettre en avant :</label>
            <textarea id="favWords" name="favWords" style="width: 100%; height: 110px;">${GM_getValue('favWords', '')}</textarea>
        </div>
        <button class="full-width" id="syncFavConfig" ${isRole ? '' : 'disabled'}>(Synchroniser) Envoyer la liste vers discord</button>
        <div style="margin-top: 10px;">
            <label for="hideWords">Produits à cacher/exclure :</label>
            <textarea id="hideWords" name="hideWords" style="width: 100%; height: 110px">${GM_getValue('hideWords', '')}</textarea>
        </div><br>
<p style="font-size: 0.9em; color: #666;">Note&nbsp;: chaque recherche différente doit être séparée par une virgule. Les majuscules ne sont pas prises en compte. Exemple&nbsp;: coque iphone, chat, HUB.<br>Si un produit est à la fois favori et exclu, il ne sera pas exclu (caché).</p>
        <div class="button-container final-buttons">
          <button class="full-width" id="saveFavConfig">Enregistrer</button>
          <button class="full-width" id="closeFavConfig">Fermer</button>
        </div>
    `;

                document.body.appendChild(popup);
                //dragElement(popup); //Utilise ta fonction existante pour rendre la popup déplaçable

                //Ajout des écouteurs d'événements pour les boutons
                document.getElementById('syncFavConfig').addEventListener('click', syncFavConfig);
                document.getElementById('saveFavConfig').addEventListener('click', saveFavConfig);
                document.getElementById('closeFavConfig').addEventListener('click', () => document.getElementById('favConfigPopup').remove());
                document.getElementById('closeFavPopup').addEventListener('click', () => {
                    document.getElementById('favConfigPopup').remove();
                });
            }


            function saveFavConfig() {
                const favWords = document.getElementById('favWords').value;
                const hideWords = document.getElementById('hideWords').value;
                GM_setValue('favWords', favWords);
                GM_setValue('hideWords', hideWords);
                document.getElementById('favConfigPopup').remove();
            }

            //Options avancés
            let dynamicFields = [];

            function updateImagePreview(inputId, imgId) {
                const inputElement = document.getElementById(inputId);
                const imgElement = document.getElementById(imgId);
                const imageUrl = inputElement.value.trim();
                if (imageUrl) {
                    imgElement.src = imageUrl;
                    imgElement.style.display = 'inline';
                } else {
                    imgElement.src = '';
                    imgElement.style.display = 'none';
                }
            }

            function getThemes() {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN
                });

                fetch(baseUrlPickme + "/shyrka/themes", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: formData.toString()
                })
                    .then(response => {
                    if (response.status === 200) {
                        return response.json();
                    } else {
                        throw new Error("Erreur lors de la récupération des thèmes");
                    }
                })
                    .then(data => {
                    const presetDropdown = document.getElementById('presetDropdown');
                    presetDropdown.innerHTML = "";
                    //Ajout des thèmes du serveur
                    data.themes.forEach(theme => {
                        const option = document.createElement('option');
                        option.value = theme.name;
                        option.textContent = theme.name;
                        presetDropdown.appendChild(option);
                    });
                    //Ajout des thèmes personnalisés stockés localement
                    const customThemes = GM_getValue('customThemes', {});
                    Object.keys(customThemes).forEach(themeName => {
                        const option = document.createElement('option');
                        option.value = themeName;
                        option.textContent = themeName + " (personnalisé)";
                        presetDropdown.appendChild(option);
                    });
                    let deleteBtn = document.getElementById('deleteCustomTheme');
                    if (!deleteBtn) {
                        deleteBtn = document.createElement('button');
                        deleteBtn.id = 'deleteCustomTheme';
                        deleteBtn.textContent = 'Supprimer';
                        deleteBtn.style.marginLeft = '5px';
                        deleteBtn.style.display = 'none';
                        presetDropdown.parentNode.insertBefore(deleteBtn, presetDropdown.nextSibling);
                    }
                    let addBtn = document.getElementById('addCustomTheme');
                    if (!addBtn) {
                        addBtn = document.createElement('button');
                        addBtn.id = 'addCustomTheme';
                        addBtn.textContent = 'Ajouter';
                        addBtn.style.marginLeft = '10px';
                        presetDropdown.parentNode.insertBefore(addBtn, deleteBtn);
                    }
                    const selectedThemeName = GM_getValue('imgTheme', 'Classique');
                    if (selectedThemeName) {
                        presetDropdown.value = selectedThemeName;
                        if (customThemes.hasOwnProperty(selectedThemeName)) {
                            deleteBtn.style.display = 'inline-block';
                        }
                    }

                    //Lors du changement de thème dans le menu déroulant
                    presetDropdown.addEventListener('change', (event) => {
                        const selectedThemeName = event.target.value;
                        const customThemes = GM_getValue('customThemes', {});
                        if (customThemes.hasOwnProperty(selectedThemeName)) {
                            //Thème personnalisé : mise à jour des champs depuis la configuration importée
                            const config = customThemes[selectedThemeName];
                            dynamicFields.forEach(field => {
                                if (config.hasOwnProperty(field)) {
                                    const inputElem = document.getElementById('opt_' + field);
                                    if (inputElem) {
                                        inputElem.value = config[field];
                                        const container = inputElem.closest('.advancedOption');
                                        if (container) {
                                            const defaultSpan = container.querySelector('.defaultValueSpan');
                                            if (defaultSpan) {
                                                defaultSpan.style.color = (inputElem.value.trim() === defaultSpan.textContent.trim()) ? '#888' : '#ff553e';
                                            }
                                        }
                                    }
                                    const previewElem = document.getElementById('preview_' + field);
                                    if (previewElem) {
                                        updateImagePreview('opt_' + field, 'preview_' + field);
                                    }
                                }
                            });
                            deleteBtn.style.display = 'inline-block';
                        } else {
                            //Thème du serveur : mise à jour dynamique sur la base de dynamicFields
                            const selectedTheme = data.themes.find(theme => theme.name === selectedThemeName);
                            if (selectedTheme) {
                                dynamicFields.forEach(field => {
                                    if (selectedTheme.hasOwnProperty(field)) {
                                        const inputElem = document.getElementById('opt_' + field);
                                        if (inputElem) {
                                            inputElem.value = selectedTheme[field];
                                            const container = inputElem.closest('.advancedOption');
                                            if (container) {
                                                const defaultSpan = container.querySelector('.defaultValueSpan');
                                                if (defaultSpan) {
                                                    defaultSpan.style.color = (inputElem.value.trim() === defaultSpan.textContent.trim()) ? '#888' : '#ff553e';
                                                }
                                            }
                                        }
                                        const previewElem = document.getElementById('preview_' + field);
                                        if (previewElem) {
                                            updateImagePreview('opt_' + field, 'preview_' + field);
                                        }
                                    }
                                });
                            }
                            deleteBtn.style.display = 'none';
                        }
                    });

                    //Événement pour supprimer un thème personnalisé
                    deleteBtn.addEventListener('click', function() {
                        const selectedThemeName = presetDropdown.value;
                        let customThemes = GM_getValue('customThemes', {});
                        if (customThemes.hasOwnProperty(selectedThemeName)) {
                            if (confirm("Voulez-vous supprimer le thème personnalisé \"" + selectedThemeName + "\" ?")) {
                                delete customThemes[selectedThemeName];
                                GM_setValue('customThemes', customThemes);
                                const optionToRemove = presetDropdown.querySelector("option[value='" + selectedThemeName + "']");
                                if (optionToRemove) {
                                    optionToRemove.remove();
                                }
                                presetDropdown.selectedIndex = 0;
                                presetDropdown.dispatchEvent(new Event('change'));
                                GM_setValue('imgTheme', presetDropdown.value);
                                deleteBtn.style.display = 'none';
                            }
                        }
                    });
                    addBtn.addEventListener('click', function() {
                        saveTheme();
                    });
                })
                    .catch(error => {
                    console.error(error);
                });
            }

            function saveTheme() {
                const themeName = prompt("Entrez le nom du thème pour l'ajouter :");
                if (!themeName) return;
                const theme = { themeName: themeName, text: {} };

                optionsElems.forEach(opt => {
                    if (opt.type === 'text') {
                        theme.text[opt.key] = opt.element.value;
                    }
                });

                let customThemes = GM_getValue('customThemes', {});
                customThemes[theme.themeName] = theme.text;
                GM_setValue('customThemes', customThemes);

                const presetDropdown = document.getElementById('presetDropdown');
                if (presetDropdown && !presetDropdown.querySelector("option[value='" + theme.themeName + "']")) {
                    const option = document.createElement('option');
                    option.value = theme.themeName;
                    option.textContent = theme.themeName + " (personnalisé)";
                    presetDropdown.appendChild(option);
                }

                //Sélection du thème importé comme thème actif
                if (presetDropdown) {
                    presetDropdown.value = theme.themeName;
                    presetDropdown.dispatchEvent(new Event('change'));
                }
                alert("Thème personnalisé '" + theme.themeName + "' ajouté avec succès.");
            }

            function exportConfig() {
                const themeName = prompt("Entrez le nom du thème pour l'exportation :");
                if (!themeName) return;
                const config = { themeName: themeName, text: {} };
                optionsElems.forEach(opt => {
                    if (opt.type === 'text') {
                        config.text[opt.key] = opt.element.value;
                    }
                });
                const json = JSON.stringify(config, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = themeName + ".json";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }

            function importConfig(config) {
                if (config.text && config.themeName) {
                    let customThemes = GM_getValue('customThemes', {});
                    customThemes[config.themeName] = config.text;
                    GM_setValue('customThemes', customThemes);
                    const presetDropdown = document.getElementById('presetDropdown');
                    if (presetDropdown && !presetDropdown.querySelector("option[value='" + config.themeName + "']")) {
                        const option = document.createElement('option');
                        option.value = config.themeName;
                        option.textContent = config.themeName + " (personnalisé)";
                        presetDropdown.appendChild(option);
                    }
                    if (presetDropdown) {
                        presetDropdown.value = config.themeName;
                        presetDropdown.dispatchEvent(new Event('change'));
                    }
                    alert("Thème personnalisé '" + config.themeName + "' importé avec succès.");
                } else {
                    alert("Fichier incorrect.");
                }
            }

            function switchReco(token, reco) {
                let formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    reco: reco,
                });

                fetch(baseUrlPickme + "/shyrka/switchreco", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (!response.ok) {
                        throw new Error("Erreur réseau : " + response.status);
                    }
                    return response.text();
                })
                    .then(responseText => {
                    if (responseText.status === "200") {
                        return true;
                    } else {
                        return false;
                    }
                })
                    .catch(error => {
                    console.error("Erreur lors de la requête :", error);
                });
            }

            let optionsElems = [];

            function createAdvancedPopup(isPremium) {
                const existingPopup = document.getElementById('advancedConfigPopup');
                if (existingPopup) {
                    existingPopup.remove();
                }

                const popup = document.createElement('div');
                popup.id = 'advancedConfigPopup';
                popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10002;
        width: 600px;
        background-color: white;
        padding: 20px;
        border: 2px solid #ccc;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        overflow: auto;
        max-height: 95vh;
    `;

                const header = document.createElement('h2');
                header.id = 'configPopupHeader';
                header.textContent = 'Paramètres avancés';
                const closeSpan = document.createElement('span');
                closeSpan.id = 'closeAdvancedPopup';
                closeSpan.style.cssText = 'float: right; cursor: pointer;';
                closeSpan.innerHTML = '&times;';
                header.appendChild(closeSpan);
                popup.appendChild(header);

                const description = document.createElement('p');
                description.style.cssText = 'font-size: 0.9em; color: #666;';
                description.innerHTML = `Attention, dans le doute ne touchez pas à ces options. Cela est uniquement pour les utilisateurs avertis.<br>
        Une valeur pour mobile, sera également prise en compte pour l'affichage réduit. Les positions sont relatives aux bords de l'image du produit. Elles doivent être exprimées en px (pixel) ou en pourcentage (%).<br>
        Pour remettre la valeur par défaut, laissez la case vide ou cliquez sur la valeur à côté de chaque option (en rouge si la valeur est différente de celle par défaut).<br>
        Vous pouvez exporter ou importer la configuration.
    `;
                popup.appendChild(description);

                const summaryContainer = document.createElement('div');
                summaryContainer.id = 'summaryContainer';
                summaryContainer.style.marginBottom = '20px';
                summaryContainer.innerHTML = '<strong>Catégories :</strong>';
                popup.appendChild(summaryContainer);

                const optionsContainer = document.createElement('div');
                optionsContainer.id = 'advancedOptionsContainer';
                popup.appendChild(optionsContainer);

                //Réinitialisation du tableau optionsElems pour chaque ouverture
                optionsElems = [];

                function ajouterOptionCheckbox(key, label, value_api = '', isPremium) {
                    let value;
                    if (value_api == '') {
                        value = GM_getValue(key, false);
                    } else {
                        value = value_api;
                    }
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'advancedOption';
                    optionDiv.style.margin = '10px 0';
                    optionDiv.style.display = 'flex';
                    optionDiv.style.alignItems = 'flex-start';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    if (value_api == '') {
                        checkbox.id = 'opt_' + key;
                    } else {
                        checkbox.id = 'optapi_' + key;
                    }
                    checkbox.checked = value;
                    checkbox.style.marginRight = '5px';

                    const labelEl = document.createElement('label');
                    labelEl.htmlFor = checkbox.id;
                    labelEl.innerHTML = label.replace(/\n/g, '<br>');
                    labelEl.style.flex = '1';

                    //Si isPremium est défini et vaut false, on désactive (grise) la case
                    if (typeof isPremium !== 'undefined' && isPremium === false) {
                        checkbox.disabled = true;
                    }

                    optionDiv.appendChild(checkbox);
                    optionDiv.appendChild(labelEl);
                    optionsContainer.appendChild(optionDiv);

                    optionsElems.push({ key: key, type: 'checkbox', element: checkbox });
                }

                function ajouterOptionTexte(key, label, defaultValue = '', linkURL = null, linkText = null) {
                    const storedValue = GM_getValue(key, defaultValue);
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'advancedOption';
                    optionDiv.style.margin = '10px 0';

                    const labelEl = document.createElement('label');
                    labelEl.htmlFor = 'opt_' + key;
                    labelEl.style.marginRight = '10px';
                    const lines = label.split('\n');
                    lines.forEach((line, index) => {
                        labelEl.appendChild(document.createTextNode(line));
                        if (index < lines.length - 1) {
                            labelEl.appendChild(document.createElement('br'));
                        }
                    });
                    labelEl.appendChild(document.createTextNode(' '));
                    if (linkURL) {
                        labelEl.appendChild(document.createTextNode('('));
                        if (!linkText) { linkText = 'Guide'; }
                        const guideLink = document.createElement('a');
                        guideLink.href = linkURL;
                        guideLink.textContent = linkText;
                        guideLink.target = '_blank';
                        guideLink.rel = 'noopener noreferrer';
                        labelEl.appendChild(guideLink);
                        labelEl.appendChild(document.createTextNode(')'));
                    }
                    optionDiv.appendChild(labelEl);

                    //Regex pour détecter les images et les fichiers audio
                    const imageRegex = /^https?:\/\/.*\.(jpg|jpeg|png|gif)$/i;
                    const mp3Regex = /\.(mp3|wav|ogg|flac|aac|m4a|wma)$/i;

                    let input;
                    //On déclare defaultSpan et updateDefaultColor dans la portée de la fonction
                    let defaultSpan = null;
                    let updateDefaultColor = function() {};

                    //Si c'est une image, on affiche l'aperçu puis le champ en dessous
                    if (imageRegex.test(storedValue)) {
                        const img = document.createElement('img');
                        img.src = storedValue;
                        img.alt = `Aperçu de ${key}`;
                        img.style.maxWidth = key === 'logoPM' ? '150px' : '30px';
                        img.style.marginRight = '10px';
                        img.id = `preview_${key}`;
                        optionDiv.appendChild(img);

                        input = document.createElement('input');
                        input.type = 'text';
                        input.id = 'opt_' + key;
                        input.value = storedValue;
                        input.style.width = storedValue.includes("http") ? '90%' : '20%';
                        input.style.padding = '5px';
                        optionDiv.appendChild(input);
                    }
                    //Si c'est un MP3 ou un webhook (defaultValue vide), on regroupe le champ et le bouton sur la même ligne
                    else if (mp3Regex.test(storedValue) || defaultValue == '') {
                        const containerDiv = document.createElement('div');
                        containerDiv.style.display = 'flex';
                        containerDiv.style.alignItems = 'center';
                        containerDiv.style.width = '100%';

                        input = document.createElement('input');
                        input.type = 'text';
                        input.id = 'opt_' + key;
                        input.value = storedValue;
                        //Le champ occupe l'espace restant grâce à flex-grow
                        input.style.flexGrow = '1';
                        input.style.padding = '5px';
                        containerDiv.appendChild(input);

                        const playButton = document.createElement('button');
                        playButton.style.padding = '5px 10px';
                        playButton.style.border = 'none';
                        playButton.style.backgroundColor = '#007bff';
                        playButton.style.color = '#fff';
                        playButton.style.borderRadius = '4px';
                        playButton.style.fontWeight = 'bold';
                        playButton.style.marginLeft = '10px';
                        playButton.id = `preview_${key}`;

                        if (defaultValue == '') {
                            playButton.textContent = 'Tester';
                            playButton.addEventListener('click', function() {
                                if (isValidUrl(input.value)) {
                                    appelURL(input.value);
                                } else {
                                    alert("Merci de saisir une URL de Webhook pour tester.");
                                }
                            });
                        } else {
                            playButton.textContent = 'Jouer le son';
                            playButton.addEventListener('click', function() {
                                playSound(input.value);
                            });
                        }
                        containerDiv.appendChild(playButton);
                        optionDiv.appendChild(containerDiv);
                    }
                    //Sinon, on affiche simplement le champ avec une largeur adaptée
                    else {
                        input = document.createElement('input');
                        input.type = 'text';
                        input.id = 'opt_' + key;
                        input.value = storedValue;
                        input.style.width = storedValue.includes("http") ? '90%' : '20%';
                        input.style.padding = '5px';
                        optionDiv.appendChild(input);
                    }

                    if (defaultValue !== '') {
                        defaultSpan = document.createElement('span');
                        defaultSpan.textContent = defaultValue;
                        defaultSpan.style.marginLeft = '10px';
                        defaultSpan.style.color = (storedValue.trim() === defaultValue) ? '#888' : '#ff553e';
                        defaultSpan.style.cursor = 'pointer';
                        defaultSpan.classList.add('defaultValueSpan');

                        updateDefaultColor = function() {
                            defaultSpan.style.color = (input.value.trim() === defaultValue) ? '#888' : '#ff553e';
                        };

                        defaultSpan.addEventListener('click', function() {
                            input.value = defaultValue;
                            //Si c'est une image, mettre à jour l'aperçu
                            if (document.getElementById('preview_' + key)) {
                                if (imageRegex.test(defaultValue)) {
                                    updateImagePreview('opt_' + key, 'preview_' + key);
                                }
                            }
                            updateDefaultColor();
                        });

                        optionDiv.appendChild(defaultSpan);
                    }

                    optionsContainer.appendChild(optionDiv);

                    optionsElems.push({ key: key, type: 'text', element: input, defaultValue: defaultValue });
                    if (!dynamicFields.includes(key)) {
                        dynamicFields.push(key);
                    }

                    input.addEventListener('blur', function() {
                        if (document.getElementById('preview_' + key)) {
                            if (imageRegex.test(input.value)) {
                                updateImagePreview('opt_' + key, 'preview_' + key);
                            }
                        }
                        if (defaultValue !== '' && defaultSpan) {
                            updateDefaultColor();
                        }
                    });
                    input.addEventListener('input', function() {
                        if (defaultValue !== '' && defaultSpan) {
                            updateDefaultColor();
                        }
                    });
                }

                function ajouterOptionListe(key, label, optionsList, defaultValue = '') {
                    const storedValue = GM_getValue(key, defaultValue);

                    //Création du conteneur de l'option
                    const optionDiv = document.createElement('div');
                    optionDiv.className = 'advancedOption';
                    optionDiv.style.margin = '10px 0';

                    //Création du label
                    const labelEl = document.createElement('label');
                    labelEl.htmlFor = 'opt_' + key;
                    labelEl.style.marginRight = '10px';
                    labelEl.appendChild(document.createTextNode(label + ' '));
                    optionDiv.appendChild(labelEl);

                    //Création de l'élément select
                    const selectEl = document.createElement('select');
                    selectEl.id = 'opt_' + key;
                    selectEl.style.padding = '5px';

                    //Remplissage de la liste déroulante avec les options
                    optionsList.forEach(opt => {
                        const option = document.createElement('option');
                        if (typeof opt === 'object') {
                            option.value = opt.value;
                            option.textContent = opt.text;
                        } else {
                            option.value = opt;
                            option.textContent = opt;
                        }
                        if (option.value === storedValue) {
                            option.selected = true;
                        }
                        selectEl.appendChild(option);
                    });
                    optionDiv.appendChild(selectEl);

                    optionsContainer.appendChild(optionDiv);

                    //Ajout de l'élément au tableau des options
                    optionsElems.push({ key: key, type: 'select', element: selectEl, defaultValue: defaultValue });
                    /*if (!dynamicFields.includes(key)) {
                    dynamicFields.push(key);
                }*/
                }

                function ajouterLienSousTitre(texte, idSousTitre) {
                    const link = document.createElement('a');
                    link.href = `#${idSousTitre}`;
                    link.textContent = texte;
                    link.style.display = 'block';
                    link.style.marginBottom = '5px';
                    summaryContainer.appendChild(link);
                }

                function ajouterSousTitre(texte) {
                    const sousTitre = document.createElement('div');
                    const sousTitreId = 'section_' + texte.replace(/\s+/g, '_');
                    sousTitre.id = sousTitreId;
                    sousTitre.className = 'advancedOptionSubtitle';
                    sousTitre.style.cssText = `
        margin: 15px 0;
        font-weight: bold;
        font-size: 1.4em;
        text-align: center;
        border-bottom: 5px solid #ccc;
        padding-bottom: 5px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

                    //Création de la flèche de gauche (pour défiler jusqu'en haut)
                    const flecheHaut = document.createElement('span');
                    flecheHaut.innerHTML = '&#x25B2;'; //▲
                    flecheHaut.style.cssText = 'cursor: pointer; margin-right: 10px;';
                    flecheHaut.title = "Aller en haut";
                    flecheHaut.addEventListener('click', function() {
                        popup.scrollTop = 0;
                    });

                    const textContainer = document.createElement('span');
                    textContainer.textContent = texte;

                    //Création de la flèche de droite (pour défiler jusqu'en bas)
                    const flecheBas = document.createElement('span');
                    flecheBas.innerHTML = '&#x25BC;'; //▼
                    flecheBas.style.cssText = 'cursor: pointer; margin-left: 10px;';
                    flecheBas.title = "Aller en bas";
                    flecheBas.addEventListener('click', function() {
                        popup.scrollTop = popup.scrollHeight;
                    });

                    sousTitre.appendChild(flecheHaut);
                    sousTitre.appendChild(textContainer);
                    sousTitre.appendChild(flecheBas);

                    optionsContainer.appendChild(sousTitre);

                    ajouterLienSousTitre(texte, sousTitre.id);
                }

                function ajouterTexte(texte) {
                    const texteDiv = document.createElement('div');
                    texteDiv.className = 'advancedOption';
                    texteDiv.style.margin = '10px 0';
                    texteDiv.style.cssText = 'font-size: 0.9em; color: #666;';
                    texteDiv.innerHTML = texte.replace(/\n/g, '<br>');
                    optionsContainer.appendChild(texteDiv);
                }

                function ajouterSeparateur() {
                    const separateur = document.createElement('hr');
                    separateur.className = 'advancedOption';
                    separateur.style.margin = '10px 0';
                    separateur.style.border = 'none';
                    separateur.style.borderTop = '1px solid #ccc';
                    optionsContainer.appendChild(separateur);
                }

                function createSortMenu(key) {
                    const options = GM_getValue(key);
                    const containerId = 'sort_' + key;
                    let sortMenuContainer = optionsContainer.querySelector('#' + containerId);
                    if (!sortMenuContainer) {
                        sortMenuContainer = document.createElement('div');
                        sortMenuContainer.id = containerId;
                        optionsContainer.appendChild(sortMenuContainer);
                    }

                    const labels = {
                        firstproduct: 'Nouveaux produits + Première découverte',
                        newproduct: 'Nouveaux produits',
                        putproduct: 'Produits mis en avant par mot-clé',
                        favproduct: 'Produits favoris',
                        price: 'Prix',
                        etv: 'ETV'
                    };

                    function getLabel(type) {
                        return labels[type] || type;
                    }

                    if (!document.getElementById('sortMenuStyles')) {
                        const style = document.createElement('style');
                        style.id = 'sortMenuStyles';
                        style.textContent = `
.sort-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  margin: 6px 0;
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-height: 32px;
  cursor: move;
  user-select: none;
}
.sort-item.over {
  border-color: #007bff;
  background: #e9f5ff;
}
.sort-item.dragging {
  opacity: 0.5;
}
.sort-item > span {
  line-height: 20px;
}
.orderToggle {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  margin: 0;
  width: 24px;
  height: 24px;
  line-height: 24px;
  font-size: 1em;
}
`;
                        document.head.appendChild(style);
                    }

                    //Handlers de drag & drop
                    let dragSrcEl = null;
                    function handleDragStart(e) {
                        dragSrcEl = this;
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', '');
                        this.classList.add('dragging');
                    }
                    function handleDragOver(e) {
                        e.preventDefault();
                        return false;
                    }
                    function handleDragEnter() {
                        this.classList.add('over');
                    }
                    function handleDragLeave() {
                        this.classList.remove('over');
                    }
                    function handleDrop(e) {
                        e.stopPropagation();
                        if (dragSrcEl !== this) {
                            const all = Array.from(sortMenuContainer.children);
                            const srcIdx = all.indexOf(dragSrcEl);
                            const tgtIdx = all.indexOf(this);
                            if (srcIdx < tgtIdx) {
                                sortMenuContainer.insertBefore(dragSrcEl, this.nextSibling);
                            } else {
                                sortMenuContainer.insertBefore(dragSrcEl, this);
                            }
                        }
                        this.classList.remove('over');
                        return false;
                    }
                    function handleDragEnd() {
                        Array.from(sortMenuContainer.children).forEach(item => {
                            item.classList.remove('over', 'dragging');
                        });
                    }
                    function addDragHandlers(item) {
                        item.addEventListener('dragstart', handleDragStart);
                        item.addEventListener('dragenter', handleDragEnter);
                        item.addEventListener('dragover', handleDragOver);
                        item.addEventListener('dragleave', handleDragLeave);
                        item.addEventListener('drop', handleDrop);
                        item.addEventListener('dragend', handleDragEnd);
                    }

                    sortMenuContainer.innerHTML = '';
                    options.forEach(opt => {
                        const item = document.createElement('div');
                        item.className = 'advancedOption sort-item';
                        item.draggable = true;
                        item.dataset.type = opt.type;
                        if (opt.order) {
                            item.dataset.order = opt.order;
                        }

                        const label = document.createElement('span');
                        label.textContent = getLabel(opt.type);
                        item.appendChild(label);

                        if (opt.type === 'price' || opt.type === 'etv') {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.className = 'orderToggle';
                            const updateIcon = order => order === 'asc' ? '⬆' : '⬇';

                            btn.innerHTML = updateIcon(opt.order);
                            btn.style.fontSize = '1.5em';
                            btn.style.fontWeight = 'bold';
                            btn.addEventListener('click', () => {
                                const current = item.dataset.order === 'asc' ? 'desc' : 'asc';
                                item.dataset.order = current;
                                btn.innerHTML = updateIcon(current);
                            });
                            item.appendChild(btn);
                        }

                        addDragHandlers(item);
                        sortMenuContainer.appendChild(item);
                    });

                    //Ajout des types manquants en fin de liste
                    const presentTypes = new Set(options.map(o => o.type));
                    Object.keys(labels).forEach(type => {
                        if (!presentTypes.has(type)) {
                            const item = document.createElement('div');
                            item.className = 'advancedOption sort-item';
                            item.draggable = true;
                            item.dataset.type = type;
                            if (type === 'price' || type === 'etv') {
                                item.dataset.order = 'asc';
                            }

                            const label = document.createElement('span');
                            label.textContent = getLabel(type);
                            item.appendChild(label);

                            if (type === 'price' || type === 'etv') {
                                const btn = document.createElement('button');
                                btn.type = 'button';
                                btn.className = 'orderToggle';
                                const updateIcon = order => order === 'asc' ? '↑' : '↓';
                                btn.textContent = updateIcon(item.dataset.order);
                                btn.addEventListener('click', () => {
                                    const current = item.dataset.order === 'asc' ? 'desc' : 'asc';
                                    item.dataset.order = current;
                                    btn.textContent = updateIcon(current);
                                });
                                item.appendChild(btn);
                            }

                            addDragHandlers(item);
                            sortMenuContainer.appendChild(item);
                        }
                    });
                }

                ajouterSousTitre('Thèmes');
                ajouterTexte('Le thème ne change que les valeurs esthétiques comme les images (ainsi que leurs emplacements) et les sons.\nCela exclu toutes les cases à cocher ou encore les Webhooks par exemple.\nL\'export et l\'import suivent également cette logique.\nEn revanche, si vous faites "Ajouter", cela sauvegarde les éléments personnels comme les Webhooks dans le thème (mais toujours pas les cases à cocher).');
                const presetDropdownDiv = document.createElement('div');
                presetDropdownDiv.style.margin = '10px 0';
                const presetLabel = document.createElement('label');
                presetLabel.textContent = 'Thème : ';
                presetLabel.htmlFor = 'presetDropdown';
                presetDropdownDiv.appendChild(presetLabel);

                const presetDropdown = document.createElement('select');
                presetDropdown.id = 'presetDropdown';
                presetDropdown.style.marginLeft = '10px';
                presetDropdown.style.marginTop = '5px';
                presetDropdownDiv.appendChild(presetDropdown);
                optionsContainer.appendChild(presetDropdownDiv);
                getThemes();

                ajouterOptionTexte('logoPM', 'URL du logo', baseUrlPickme + "/img/PM.png");

                ajouterSousTitre('Icônes Favori/Cacher');
                ajouterOptionCheckbox('hideBas', 'Ajouter des boutons en bas de page pour rendre visibles ou cacher les produits (en plus de ceux en haut de page)');
                ajouterSeparateur();
                ajouterOptionTexte('favUrlOn', 'URL de l\'image du favori', baseUrlPickme + "/img/coeurrouge2.png");
                ajouterOptionTexte('favUrlOff', 'URL de l\'image du non favori', baseUrlPickme + "/img/coeurgris2.png");
                ajouterSeparateur();
                ajouterOptionTexte('favSize', 'Dimensions de l\'image des favoris', '23px');
                ajouterOptionTexte('favHorizontal', 'Position horizontale (favori)', '-11.5px');
                ajouterOptionTexte('favVertical', 'Position verticale (favori)', '-11.5px');
                ajouterSeparateur();
                ajouterOptionTexte('favSizeMobile', '(Mobile) Dimensions de l\'image des favoris', '15.8px');
                ajouterOptionTexte('favHorizontalMobile', '(Mobile) Position horizontale (favori)', '0px');
                ajouterOptionTexte('favVerticalMobile', '(Mobile) Position verticale (favori)', '0px');
                ajouterSeparateur();
                ajouterOptionTexte('hideUrlOn', 'URL de l\'image pour montrer', baseUrlPickme + "/img/eye.png");
                ajouterOptionTexte('hideUrlOff', 'URL de l\'image pour cacher', baseUrlPickme + "/img/eyehidden.png");
                ajouterSeparateur();
                ajouterOptionTexte('hideSizeWidth', 'Largeur de l\'image (cacher)', '33.5px');
                ajouterOptionTexte('hideSizeHeight', 'Hauteur de l\'image (cacher)', '33.5px');
                ajouterOptionTexte('hideHorizontal', 'Position horizontale (cacher)', '-16.75px');
                ajouterOptionTexte('hideVertical', 'Position verticale (cacher)', '-16.75px');
                ajouterSeparateur();
                ajouterOptionTexte('hideSizeWidthMobile', '(Mobile) Largeur de l\'image (cacher)', '23px');
                ajouterOptionTexte('hideSizeHeightMobile', '(Mobile) Hauteur de l\'image (cacher)', '23px');
                ajouterOptionTexte('hideHorizontalMobile', '(Mobile) Position horizontale (cacher)', '-2.5px');
                ajouterOptionTexte('hideVerticalMobile', '(Mobile) Position verticale (cacher)', '-2.5px');

                ajouterSousTitre('Temps d\'ancienneté des produits');
                ajouterOptionTexte('timeFont', 'Taille de police', '12px');
                ajouterOptionTexte('timeHorizontal', 'Position horizontale', '50%');
                ajouterOptionTexte('timeVertical', 'Position verticale', '1px');
                ajouterSeparateur();
                ajouterOptionTexte('timeFontMobile', '(Mobile) Taille de police', '10px');
                ajouterOptionTexte('timeHorizontalMobile', '(Mobile) Position horizontale', '50%');
                ajouterOptionTexte('timeVerticalMobile', '(Mobile) Position verticale', '1px');

                ajouterSousTitre('Filtre par mots-clés');
                ajouterOptionCheckbox('hlFav', 'Mettre en surbrillance le mot mis en avant');
                ajouterOptionTexte('colorHlFav', 'Couleur de surbrillance du mot mis en avant', 'Khaki', 'https://htmlcolorcodes.com/fr/noms-de-couleur/', 'Guide');
                ajouterSeparateur();
                ajouterOptionCheckbox('hlHide', 'Mettre en surbrillance le mot exclu');
                ajouterOptionTexte('colorHlHide', 'Couleur de surbrillance du mot exclu', 'Brown', 'https://htmlcolorcodes.com/fr/noms-de-couleur/', 'Guide');

                ajouterSousTitre('Tri personnalisé des produits');
                ajouterTexte('L\'ordre du tri définit la priorité des critères.\nAttention, les produits dont le prix ou l\'ETV n\'est pas connu seront exclus du tri par ces critères. De même que si vous n\'affichez pas ces informations, le tri pour ces critères sera ignoré.');
                ajouterOptionCheckbox('menuSorting', 'Afficher le menu déroulant pour trier sur les pages');
                ajouterOptionCheckbox('customSortingEnabled', 'Utiliser le tri personnalisé automatiquement à chaque rafraichissement d\'une page');
                createSortMenu('customSorting');

                ajouterSousTitre('Partage des recommandations');
                ajouterTexte('En un clic, copie la liste de vos recommandations dans le presse-papiers pour la coller sur discord.');
                ajouterSeparateur();
                ajouterOptionCheckbox('shareReco', 'Ajouter le bouton pour partager les recommandations');
                ajouterOptionCheckbox('shareOnlyProduct', 'Ne pas partager les liens vers les produits');
                ajouterOptionCheckbox('shareOnlyShow', 'Ne pas partager les produits cachés, seulement les visibles');

                ajouterSousTitre('Auto-refresh');
                ajouterOptionCheckbox('autoRefreshTimeSlot', 'Activer le refresh uniquement pendant la plage horaire (hors refresh horaire)');
                ajouterOptionTexte('timeSlotStart', 'Heure début (format HH:mm)', '02:00');
                ajouterOptionTexte('timeSlotEnd', 'Heure fin (format HH:mm)', '14:00');
                ajouterOptionCheckbox('refreshOnlyReco', 'Quand le prochain refresh est horaire, il ne fonctionne que si on est sur la page des recommandations');
                ajouterOptionCheckbox('refreshHideUI', 'Cacher l\'interface si on utilise uniquement le refresh horaire');
                ajouterOptionCheckbox('refreshFixed', 'Le timer ne défile pas avec la page, il est dans une position fixe');
                ajouterSeparateur();
                ajouterOptionTexte('refreshHorizontal', 'Position horizontale', '50%');
                ajouterOptionTexte('refreshVertical', 'Position verticale', '135px');
                ajouterOptionTexte('refreshVerticalNoHeader', 'Position verticale quand on cache le header', '5px');

                ajouterSousTitre('Première découverte des produits');
                ajouterOptionCheckbox('firstSeenEnabled', 'Afficher une image quand vous êtes le premier utilisateur à voir un produit');
                ajouterOptionCheckbox('firstSeenAllTime', 'Afficher l\'image tout le temps et pas uniquement la première fois que vous avez vu le produit');
                ajouterOptionCheckbox('firstSeenOver', 'Afficher l\'image par dessus le temps d\'ancienneté et le prix');
                ajouterSeparateur();
                ajouterOptionTexte('firstSeenUrl', 'URL de l\'image de découverte', baseUrlPickme + "/img/firstseen.png");
                ajouterSeparateur();
                ajouterOptionTexte('firstSeenWidth', 'Largeur de l\'image', '120px');
                ajouterOptionTexte('firstSeenHeight', 'Hauteur de l\'image', '120px');
                ajouterOptionTexte('firstSeenHorizontal', 'Position horizontale', '0px');
                ajouterOptionTexte('firstSeenVertical', 'Position verticale', '0px');
                ajouterSeparateur();
                ajouterOptionTexte('firstSeenWidthMobile', '(Mobile) Largeur de l\'image', '70px');
                ajouterOptionTexte('firstSeenHeightMobile', '(Mobile) Hauteur de l\'image', '70px');
                ajouterOptionTexte('firstSeenHorizontalMobile', '(Mobile) Position horizontale', '0px');
                ajouterOptionTexte('firstSeenVerticalMobile', '(Mobile) Position verticale', '0px');

                ajouterSousTitre('Processus de commande');
                ajouterOptionCheckbox('showCheckout', 'Afficher si on a le nouveau processus de commande ou non (l\'affichage ne prend pas en compte si on force ou non l\'ancien)');
                ajouterOptionCheckbox('oldCheckoutEnabled', 'Forcer l\'ancienne validation de commande (sans la page de règlement, cette option peut être détectée par Amazon, donc à utiliser en connaissance de cause)');
                ajouterOptionCheckbox('checkoutNewTab', 'Ouvrir la page de validation dans un nouvel onglet (cette option peut ne pas fonctionner chez tous et retourner une erreur lors du passage de commande)');
                ajouterOptionCheckbox('checkoutButtonUp', 'Remonter le bouton "Demandez plus d’articles Amazon Vine" en début de page');
                ajouterOptionCheckbox('checkoutRedirect', 'Rediriger le bouton "Demandez plus d’articles Amazon Vine" vers l\'onglet par défaut choisi dans le menu PickMe');

                ajouterSousTitre('Ronde');
                ajouterTexte('La ronde consiste à parcourir toutes les pages dans "Autres articles", afin de mettre à jour tous les produits localement mais aussi sur le serveur.');
                ajouterSeparateur();
                ajouterOptionCheckbox('rondeEnabled', 'Activer la ronde');
                ajouterOptionCheckbox('rondeFirst', 'Toujours commencer la ronde en page 1');
                ajouterOptionCheckbox('rondeResume', 'A la fin de la ronde, copier le résumé de celle-ci dans le presse-papiers');
                ajouterOptionCheckbox('rondeHide', 'Cacher automatiquement tous les objets à chaque page');
                ajouterOptionCheckbox('rondeFixed', 'Le bouton ne défile pas avec la page, il est dans une position fixe');
                ajouterSeparateur();
                ajouterOptionTexte('rondeDelay', 'Délai (en secondes) entre chaque page', '5');
                ajouterOptionTexte('rondeRandom', 'Délai maximum aléatoire (en secondes) ajouté au délai précédent', '5');
                ajouterSeparateur();
                ajouterOptionTexte('rondePlayUrl', 'URL de l\'image du bouton play', baseUrlPickme + '/img/play.png');
                ajouterOptionTexte('rondePauseUrl', 'URL de l\'image du bouton play', baseUrlPickme + '/img/pause.png');
                ajouterOptionTexte('rondeStopUrl', 'URL de l\'image du bouton stop', baseUrlPickme + '/img/stop.png');
                ajouterSeparateur();
                ajouterOptionTexte('rondeHorizontal', 'Position horizontale', '50%');
                ajouterOptionTexte('rondeVertical', 'Position verticale', '50px');
                ajouterOptionTexte('rondeVerticalHeader', 'Position verticale quand on cache le header', '50px');

                ajouterSousTitre('Lors d\'une nouvelle recommandation');
                ajouterTexte('Le premier Webhook est appelé à chaque nouvelle recommandation, sans conditions. Le second passe dans le filtre des mots-clés (bouton "Configurer les mots-clés pour le filtre" dans le menu principal).\nLes deux peuvent être actifs en même temps.');
                ajouterSeparateur();
                ajouterOptionCheckbox('callUrlEnabled', '(Webhook) Appeler une URL');
                ajouterOptionTexte('callUrl', 'URL du Webhook', '');
                ajouterSeparateur();
                ajouterOptionCheckbox('callUrlFavEnabled', '(Webhook avec filtres) Appeler une URL');
                ajouterOptionTexte('callUrlFav', 'URL du Webhook avec filtres', '');
                const optionsTypeFav = [
                    { value: "callFavOnly", text: "N'appeler que pour les produits avec mots clés" },
                    { value: "callExcludeHidden", text: "Toujours appeler sauf mots exclus" }
                ];
                ajouterOptionListe('callUrlTypeFav', 'Filtres du Webhook :', optionsTypeFav, "callFavOnly");
                ajouterSeparateur();
                ajouterOptionCheckbox('soundRecoEnabled', 'Jouer un son');
                ajouterOptionTexte('recoSoundUrl', 'URL du son', baseUrlPickme + '/sw/notif3.mp3');

                ajouterSousTitre('Quantité dans les catégories');
                ajouterOptionCheckbox('catEnabled', 'Activer l\'affichage de la différence de quantité dans les catégories.\nSe réinitialise à chaque fois que vous voyez un nouveau produit ou quand vous appuyez sur le bouton "Reset"');
                ajouterOptionCheckbox('catGras', 'Mettre en gras les +/- des catégories');
                ajouterOptionCheckbox('catManuelReset', 'Ne reset les +/- des catégories qu\'avec le bouton Reset (au lieu de le faire à la découverte d\'un nouveau produit)');

                ajouterSousTitre('Filtre des produits pour adultes');
                ajouterOptionCheckbox('NSFWEnabled', 'Flouter les produits pour adultes');
                ajouterOptionTexte('blurLevel', 'Intensité du flou (plus le chiffre est grand, moins on verra l\'image)', '15');
                ajouterOptionCheckbox('NSFWHide', 'Cacher automatiquement les produits pour adultes');

                ajouterSousTitre('Divers');
                ajouterOptionTexte('newUrl', 'URL de l\'image lors d\'un nouveau produit', baseUrlPickme + '/img/new.png');
                ajouterOptionTexte('notifUrl', 'URL du son des notifications', baseUrlPickme + '/sw/notif3.mp3');
                ajouterOptionTexte('fullTitleLine', 'Nombre de lignes quand on affiche le nom complet des produits.\nLa valeur devenant fixe, cela peut augmenter inutilement la taille des encadrés produits et le rendu peut être variable suivant l\'appareil (PC, mobile, taille de l\'écran, etc...)', '4');
                ajouterOptionTexte('extendedDelay', 'Délai (en ms) pour afficher les noms complets des produits (à augmenter si l\'affichage du nom complet ne fonctionne pas', '600');
                ajouterOptionCheckbox('taxValue', 'Remonter l\'affichage de la valeur fiscale estimée (et des variantes sur mobile)');
                ajouterOptionCheckbox('isParentEnabled', 'Distinguer les produits ayant des variantes. Si c\'est le cas, cela ajoute l\'icone 🛍️ dans le texte du bouton des détails');
                ajouterOptionCheckbox('notepadEnabled', 'Activer le Bloc-notes');
                ajouterOptionTexte('sizeMobileCat', 'Tailles des boutons de catégories (RFY, AFA, AI) en affichage mobile', '32px');
                ajouterSeparateur();
                ajouterOptionCheckbox('notifVolumeEnabled', 'Contrôler le volume des notifications');
                ajouterOptionTexte('notifVolume', 'Volume des notifications, valeur entre 0 et 1 (0 = muet, 1 = max)', '1');
                ajouterSeparateur();
                ajouterOptionTexte('favNew', 'Durée (en minutes) pendant laquelle un favori est marqué comme étant récent dans l\'onglet des favoris', '1');
                ajouterOptionTexte('favOld', 'Durée (en heures) au delà de laquelle un favori est marqué comme étant obsolète dans l\'onglet des favoris', '12');
                ajouterSeparateur();
                ajouterOptionCheckbox('columnEnabled', 'Rendre fixe le nombre de colonnes des produits');
                ajouterOptionTexte('nbColumn', 'Nombre de colonnes', '5');
                ajouterSeparateur();
                ajouterOptionCheckbox('forceIos', 'Forcer la détection de iOS (à activer si certaines options ne fonctionnent pas car l\'appareil n\'est pas correctement détecté comme étant sous iOS)');
                ajouterSeparateur();
                ajouterOptionCheckbox('colorblindEnabled', 'Mode daltonien');

                ajouterSousTitre('(Premium) ETV / Prix');
                ajouterOptionCheckbox('showPrice', 'Afficher le prix en plus de l\'ETV (le format d\'affichage sera toujours le suivant : Prix / ETV). Si le prix n\'est pas connu, seul l\'ETV est visible');
                ajouterOptionCheckbox('showPriceIcon', 'Remplacer l\'affichage de l\'ETV et du prix par des icônes');
                ajouterOptionCheckbox('flagETV', 'Afficher le drapeau d\'origine du vendeur à côté de l\'ETV à la place du bouton de détails');
                ajouterOptionTexte('iconPrice', 'Icône prix', '💰');
                ajouterOptionTexte('iconETV', 'Icône ETV', '💸');
                ajouterSeparateur();
                ajouterOptionTexte('etvFont', 'Taille de police', '12px');
                ajouterOptionTexte('etvHorizontal', 'Position horizontale', '50%');
                ajouterOptionTexte('etvVertical', 'Position verticale', '1px');
                ajouterSeparateur();
                ajouterOptionTexte('etvFontMobile', '(Mobile) Taille de police', '10px');
                ajouterOptionTexte('etvHorizontalMobile', '(Mobile) Position horizontale', '50%');
                ajouterOptionTexte('etvVerticalMobile', '(Mobile) Position verticale', '1px');

                ajouterSousTitre('(Premium) Statistiques/Infos serveur');
                ajouterOptionCheckbox('onlyETV', 'N\'afficher que l\'ETV et non les "boules" de statistiques des commandes');
                ajouterOptionCheckbox('statsInReviews', 'Afficher également les informations de la communauté sur les commandes dans les avis');
                ajouterOptionCheckbox('nbReco', '(Premium+) Afficher le nombre de recommandations du jour (ne fonctionne que si vous avez activé l\'option pour recevoir les nouvelles recommandations en message privé sur discord)');
                ajouterSeparateur();
                ajouterOptionTexte('iconVariant', 'Icône produit avec variant', "🛍️");
                ajouterOptionTexte('iconLimited', 'Icône produit limité', "⌛");
                ajouterSeparateur();
                ajouterOptionTexte('ballUrlSuccess', 'URL de l\'image d\'une commande réussie', baseUrlPickme + "/img/orderok.png");
                ajouterOptionTexte('ballUrlError', 'URL de l\'image d\'une commande en erreur', baseUrlPickme + "/img/ordererror.png");
                ajouterSeparateur();
                ajouterOptionTexte('ballSize', 'Dimensions de l\'image', '28px');
                ajouterOptionTexte('ballFont', 'Taille de police du chiffre', '14px');
                ajouterOptionTexte('ballHorizontal', 'Position horizontale', '-14px');
                ajouterOptionTexte('ballVertical', 'Position verticale', '-14px');
                ajouterSeparateur();
                ajouterOptionTexte('ballSizeMobile', '(Mobile) Dimensions de l\'image', '21px');
                ajouterOptionTexte('ballFontMobile', '(Mobile) Taille de police du chiffre', '12px');
                ajouterOptionTexte('ballHorizontalMobile', '(Mobile) Position horizontale', '0px');
                ajouterOptionTexte('ballVerticalMobile', '(Mobile) Position verticale', '0px');

                function exportConfig() {
                    const themeName = prompt("Entrez le nom du thème pour l'exportation :");
                    if (!themeName) return;
                    const config = { themeName: themeName, text: {} };

                    //Liste des clés à exclure de l'export
                    const excludeKeys = ['callUrl', 'callUrlFav', 'fullTitleLine', 'rondeDelay', 'rondeRandom', 'blurLevel', 'nbColumn'];

                    optionsElems.forEach(opt => {
                        if (opt.type === 'text' && !excludeKeys.includes(opt.key)) {
                            config.text[opt.key] = opt.element.value;
                        }
                    });

                    const json = JSON.stringify(config, null, 2);
                    const blob = new Blob([json], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = themeName + ".json";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }


                function importConfig(config) {
                    if (config.text && config.themeName) {
                        let customThemes = GM_getValue('customThemes', {});
                        customThemes[config.themeName] = config.text;
                        GM_setValue('customThemes', customThemes);
                        const presetDropdown = document.getElementById('presetDropdown');
                        if (presetDropdown && !presetDropdown.querySelector("option[value='" + config.themeName + "']")) {
                            const option = document.createElement('option');
                            option.value = config.themeName;
                            option.textContent = config.themeName + " (personnalisé)";
                            presetDropdown.appendChild(option);
                        }
                        if (presetDropdown) {
                            presetDropdown.value = config.themeName;
                            presetDropdown.dispatchEvent(new Event('change'));
                        }
                        alert("Thème personnalisé '" + config.themeName + "' importé avec succès.");
                    } else {
                        alert("Fichier incorrect.");
                    }
                }

                //Création du bouton "Exporter configuration"
                const exportBtn = document.createElement('button');
                exportBtn.id = 'exportConfig';
                exportBtn.className = 'full-width';
                exportBtn.textContent = 'Exporter configuration';
                exportBtn.style.width = '49%';
                exportBtn.style.marginRight = '2%';
                exportBtn.addEventListener('click', exportConfig);

                //Création du bouton "Importer configuration"
                const importBtn = document.createElement('button');
                importBtn.id = 'importConfig';
                importBtn.className = 'full-width';
                importBtn.textContent = 'Importer configuration';
                importBtn.style.width = '49%';
                importBtn.addEventListener('click', function() {
                    importInput.click();
                });

                const importInput = document.createElement('input');
                importInput.type = 'file';
                importInput.accept = 'application/json';
                importInput.style.display = 'none';
                importInput.addEventListener('change', function(e) {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = function(evt) {
                            try {
                                const config = JSON.parse(evt.target.result);
                                importConfig(config);
                            } catch (e) {
                                alert('Erreur lors de l\'importation de la configuration.');
                            }
                        };
                        reader.readAsText(file);
                    }
                });

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'button-container final-buttons';
                buttonContainer.style.marginTop = '20px';

                const restoreBtn = document.createElement('button');
                restoreBtn.className = 'full-width';
                restoreBtn.id = 'restoreAdvancedConfig';
                restoreBtn.textContent = 'Restaurer les paramètres par défaut';

                const saveBtn = document.createElement('button');
                saveBtn.className = 'full-width';
                saveBtn.id = 'saveAdvanced';
                saveBtn.textContent = 'Enregistrer';

                const closeBtn = document.createElement('button');
                closeBtn.className = 'full-width';
                closeBtn.id = 'closeAdvanced';
                closeBtn.textContent = 'Fermer';

                buttonContainer.appendChild(exportBtn);
                buttonContainer.appendChild(importBtn);
                buttonContainer.appendChild(restoreBtn);
                buttonContainer.appendChild(saveBtn);
                buttonContainer.appendChild(closeBtn);

                buttonContainer.appendChild(importInput);

                popup.appendChild(buttonContainer);
                document.body.appendChild(popup);

                const optCallUrlEnabled = document.getElementById('opt_callUrlEnabled');
                const optCallUrl = document.getElementById('opt_callUrl');
                const optCallUrlFavEnabled = document.getElementById('opt_callUrlFavEnabled');
                const optCallUrlFav = document.getElementById('opt_callUrlFav');
                const optfullTitleLine = document.getElementById('opt_fullTitleLine');

                optCallUrlEnabled.addEventListener('change', function() {
                    if (this.checked) {
                        if (optCallUrl.value.trim() === '') {
                            alert("Merci de saisir une URL de Webhook avant d'activer l'option.");
                            this.checked = false;
                        }
                    }
                });

                optCallUrl.addEventListener('blur', function() {
                    const urlValue = this.value.trim();
                    if (urlValue !== '' && !isValidUrl(urlValue)) {
                        this.value = '';
                        optCallUrlEnabled.checked = false;
                        alert("URL invalide. Veuillez entrer une URL valide.");
                    } else if (urlValue !== '') {
                        optCallUrlEnabled.checked = false;
                    }
                });

                optCallUrlFavEnabled.addEventListener('change', function() {
                    if (this.checked) {
                        if (optCallUrlFav.value.trim() === '') {
                            alert("Merci de saisir une URL de Webhook avant d'activer l'option.");
                            this.checked = false;
                        }
                    }
                });

                optCallUrlFav.addEventListener('blur', function() {
                    const urlValue = this.value.trim();
                    if (urlValue !== '' && !isValidUrl(urlValue)) {
                        this.value = '';
                        optCallUrlFavEnabled.checked = false;
                        alert("URL invalide. Veuillez entrer une URL valide.");
                    } else if (urlValue !== '') {
                        optCallUrlFavEnabled.checked = false;
                    }
                });

                optfullTitleLine.addEventListener('change', function() {
                    const lineValue = this.value.trim();
                    if (!/^-?\d+$/.test(lineValue)) {
                        this.value = '4';
                        alert("La valeur doit être un entier.");
                    }
                });

                closeSpan.addEventListener('click', () => { popup.remove(); });
                closeBtn.addEventListener('click', () => { popup.remove(); });

                saveBtn.addEventListener('click', () => {
                    const selectedThemeName = presetDropdown.value;
                    GM_setValue('imgTheme', selectedThemeName);
                    optionsElems.forEach(opt => {
                        if (opt.type === 'checkbox') {
                            GM_setValue(opt.key, opt.element.checked);
                        } else if (opt.type === 'text') {
                            //Utilise la valeur par défaut si le champ est vide (après suppression des espaces inutiles)
                            const value = opt.element.value.trim();
                            GM_setValue(opt.key, value === '' ? opt.defaultValue : value);
                        } else if (opt.type === 'select') {
                            GM_setValue(opt.key, opt.element.value);
                        }
                    });
                    optionsContainer
                        .querySelectorAll('[id^="sort_"]')
                        .forEach(sortMenuContainer => {
                        const key = sortMenuContainer.id.slice(5); //enlève le "sort_"
                        const customSorting = Array.from(sortMenuContainer.children).map(item => {
                            const entry = { type: item.dataset.type };
                            if (item.dataset.order) {
                                entry.order = item.dataset.order;
                            }
                            return entry;
                        });
                        GM_setValue(key, customSorting);
                    });
                    popup.remove();
                });

                restoreBtn.addEventListener('click', () => {
                    if (confirm("Êtes-vous sûr de vouloir restaurer toutes les valeurs par défaut (zone de texte uniquement) ?")) {
                        const defaultSpans = popup.querySelectorAll('.defaultValueSpan');
                        defaultSpans.forEach(span => { span.click(); });
                    }
                });
            }

            function syncFavConfig() {
                if (confirm('Cela remplacera votre liste de mots-clés sur discord par celle de PickMe, êtes-vous sûr ?')) {
                    const favWords = document.getElementById('favWords').value;
                    const formData = new URLSearchParams({
                        version: version,
                        token: API_TOKEN,
                        keywords: favWords,
                    });

                    return fetch(baseUrlPickme + "/shyrka/synckeywords", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formData.toString()
                    })
                        .then(response => {
                        if (response.status === 200) {
                            //On récupère le texte de la réponse
                            return response.text().then(text => {
                                const syncButton = document.getElementById('syncFavConfig');
                                const originalText = syncButton.textContent;
                                syncButton.innerHTML = text;
                                setTimeout(() => {
                                    syncButton.textContent = originalText;
                                }, 2000);
                                return {status: response.status, responseText: text};
                            });
                        } else if (response.status === 201) {
                            const syncButton = document.getElementById('syncFavConfig');
                            syncButton.innerHTML = 'Non autorisé';
                            syncButton.disabled = true;
                            return "Non autorisé";
                        } else {
                            throw new Error("Erreur lors de la récupération de la dernière sauvegarde");
                        }
                    })
                        .catch(error => {
                        throw new Error("Erreur lors de la récupération de la dernière sauvegarde : " + error);
                    });
                }
            }

            //Modification de la fonction configurerTouches pour ouvrir la popup
            function configurerTouches(isPremium) {
                createKeyConfigPopup(isPremium);
            }
            function configurerFiltres() {
                createFavConfigPopup();
            }
            function configurerNotif() {
                createNotifConfigPopup();
            }
            function configurerAdvanced(isPremium) {
                createAdvancedPopup(isPremium);
            }
            //End

            //Supprime les produits la depuis plus de 90 jours
            function purgeOldItems() {
                const items = GM_getValue("config");
                const storedProducts = getStoredProducts();
                const date = new Date().getTime();

                for (const obj in items) {
                    ((date - items[obj].date) >= ITEM_EXPIRY) ? delete items[obj] : null;
                }
                GM_setValue("config", items);
                //if (fullloadEnabled && !autohideEnabled) {
                //displayContent();
                //setTimeout(displayContent, 200);
                //}
            }
            //purgeOldItems();

            function truncateString(originalString) {
                var arr = originalString.split('\n');
                var tooLong = true;
                var variantsRemoved = {};
                var variantQuantities = {};
                var truncatedString = '';
                var count = 0;

                function compareItemLengths(y) {
                    for (let x=0; x<arr.length; x++) {
                        if (x !== y && variantQuantities[y] >= variantQuantities[x] ) {
                            return true;
                        }
                    }
                }

                while (tooLong) {

                    if (count > 30) {
                        tooLong = false;
                    }

                    for (let x=0; x<arr.length; x++) {
                        var split = arr[x].split(' ● ');
                        var fullArrayLength = arr.join('').length;
                        if (split.length > 1 && !variantQuantities[x]) {
                            variantQuantities[x] = split.length;
                        }

                        if (split.length > 1 && fullArrayLength > MAX_COMMENT_LENGTH && compareItemLengths(x)) {
                            variantQuantities[x] = split.length - 1;
                            variantsRemoved[x] = (variantsRemoved.hasOwnProperty(x)) ? variantsRemoved[x]+1 : 1;
                            split.pop();
                            arr[x] = split.join(' ● ');
                            arr[x] += `** ... +${variantsRemoved[x]} more**`;
                        } else if (fullArrayLength <= MAX_COMMENT_LENGTH) {
                            break;
                        }
                    }

                    if (!(arr.join('\n').length > MAX_COMMENT_LENGTH)) {
                        truncatedString = arr.join('\n');
                        tooLong = false;
                    }
                    count++;
                }

                return truncatedString.trim();
            }

            //Fast command
            function addFastCmd() {
                const savedAddress = GM_getValue('savedAddress', null);
                const dataFastCmd = GM_getValue('fastCmdVar', null);
                let addressId = null;
                let legacyAddressId = null;
                //Vérifier si un objet a été récupéré
                if (savedAddress && dataFastCmd) {
                    //Stocker les valeurs de addressId et legacyAddressId dans les variables
                    addressId = savedAddress.addressId;
                    legacyAddressId = savedAddress.legacyAddressId;
                } else {
                    return;
                }

                const oldCsrfLocation = document.body.querySelector('input[name="csrf-token"]');
                const csrfToken = oldCsrfLocation && oldCsrfLocation.value || JSON.parse(document.querySelector('.vvp-body > [type="a-state"]').innerText).csrfToken;

                function createCartPurchaseButton(item) {
                    const isParent = item.querySelector('input').getAttribute('data-is-parent-asin') === 'true';

                    const asin = item.querySelector('.'+getStringDetailsBtnSelector()+' .a-button-input')?.dataset.asin || item.querySelector('.a-button-input')?.dataset.asin;
                    const recommendationId = item.getAttribute('data-recommendation-id');

                    const cartButton = document.createElement('button');
                    cartButton.type = 'button';
                    cartButton.className = 'a-button a-button-primary';
                    //cartButton.style.height = '30px'
                    if (mobileEnabled || cssEnabled) {
                        cartButton.style.display = 'block';
                        cartButton.style.marginLeft = '8px';
                        cartButton.style.setProperty('margin-top', '3px', 'important');
                    } else {
                        cartButton.style.setProperty('margin-top', '-10px', 'important');
                    }
                    //Bouton pour produit unique ou avec variantes
                    const buttonText = (mobileEnabled || cssEnabled)
                    ? (isParent ? '🚀' : '🚀')
                    : (isParent ? '🚀 Commande rapide' : '🚀 Commande rapide');

                    const paddingStyle = (mobileEnabled || cssEnabled) ? 'padding: 4px 8px;' : '';

                    cartButton.innerHTML = `<span class="a-button-inner"><span class="a-button-text emoji" style="${paddingStyle}">${buttonText}</span></span>`;
                    cartButton.onclick = () => cartPurchase(recommendationId, asin, isParent)
                    item.querySelector('.vvp-item-tile-content').appendChild(cartButton)
                }

                function showOrderResult(result, error) {
                    if (result != null) {
                        let orderId = result.orderId;
                        let targetDiv = document.getElementById("vvp-scheduled-delivery-required-msg");
                        let newDiv = document.createElement("div");

                        newDiv.id = "vvp-generic-order-success-msg";
                        newDiv.className = "a-box a-alert a-alert-success";
                        newDiv.setAttribute("aria-live", "polite");
                        newDiv.setAttribute("aria-atomic", "true");

                        newDiv.innerHTML = '<div class="a-box-inner a-alert-container">' +
                            '<h4 class="a-alert-heading">Réussite&nbsp;!</h4>' +
                            '<i class="a-icon a-icon-alert"></i>' +
                            '<div class="a-alert-content">Votre demande de produit a été soumise.</div><strong>(Commande rapide PickMe) Numéro de commande : ' + orderId +
                            '</strong></div>';

                        targetDiv.insertAdjacentElement('afterend', newDiv);
                    } else {
                        let targetDiv = document.getElementById("vvp-scheduled-delivery-required-msg");
                        let newDiv = document.createElement("div");

                        newDiv.id = "vvp-generic-request-error-msg";
                        newDiv.className = "a-box a-alert a-alert-error";
                        newDiv.setAttribute("role", "alert");

                        newDiv.innerHTML = '<div class="a-box-inner a-alert-container">' +
                            '<h4 class="a-alert-heading">Erreur</h4>' +
                            '<i class="a-icon a-icon-alert"></i>' +
                            '<div class="a-alert-content">' +
                            'Un problème est survenu lors de la création de votre demande. Demandez un autre article.<br><strong>(Commande rapide PickMe) Code erreur : ' + error +
                            '</strong> (<a href="' + baseUrlPickme + '/wiki/doku.php?id=plugins:pickme:codes_erreur" target="_blank">wiki des codes d\'erreurs</a>)</div>' +
                            '</div>';

                        targetDiv.insertAdjacentElement('afterend', newDiv);
                    }
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }

                async function cartPurchase(recommendationId, asin, isParent) {
                    //Prendre la première variation d'un produit
                    if (isParent) {
                        const encodedId = encodeURIComponent(recommendationId)
                        const url = `https://www.amazon.fr/vine/api/recommendations/${encodedId}`

                        try {
                            const response = await fetch(url)
                            const data = await response.json()
                            asin = data.result?.variations?.[0]?.asin
                        } catch (error) {
                            console.log('[PïckMe] FastCmd error fetching variation ASIN', error)
                            return
                        }
                    }

                    //On check que tout a une valeur
                    if (!recommendationId || !asin || !addressId || !legacyAddressId || !csrfToken || !dataFastCmd) {
                        console.log('[PïckMe] FastCmd : Impossible, données manquantes')
                        return
                    }

                    const payload = JSON.stringify({
                        recommendationId: recommendationId,
                        recommendationType: "SEARCH",
                        itemAsin: asin,
                        addressId: addressId,
                        legacyAddressId: legacyAddressId
                    })

                    try {
                        const req = await fetch(dataFastCmd, {
                            method: 'POST',
                            body: payload,
                            headers: {
                                'anti-csrftoken-a2z': csrfToken,
                                'content-type': 'application/json'
                            }
                        })

                        const response = await req.json()

                        //Lignes de tests
                        //var response = '{"result":null,"error":"ITEM_NOT_IN_ENROLLMENT"}';
                        //var response = '{"result":{"orderId":"404-12345-6789","legacyOrderId":null,"recommendationType":null,"recommendationId":null,"itemAsin":null,"customerId":null,"addressId":null,"legacyAddressId":null,"slateToken":null},"error":null}'
                        //var responseObject = JSON.parse(response);
                        //console.log(responseObject);

                        var responseObject = JSON.parse(JSON.stringify(response));
                        var result = responseObject.result;
                        var error = responseObject.error;
                        showOrderResult(result, error);
                    } catch (error) {
                        console.log('[PïckMe] FastCmd failed : ', error)
                    }
                }

                document.body.querySelectorAll('.vvp-item-tile').forEach(createCartPurchaseButton)
            }

            //Met a jour le bouton s'il y a des variantes du produit
            function changeButtonProduct(item) {
                const isParent = item.querySelector('input').getAttribute('data-is-parent-asin') === 'true'
                var button = item.querySelector('.a-button-text');
                var newText = "";
                if (isParent && isParentEnabled) {
                    newText = iconVariant + " ";
                }
                if (mobileEnabled || cssEnabled) {
                    newText = newText + "Détails";
                } else {
                    newText = newText + "Voir les détails";
                }
                button.textContent = newText;
            }

            //Met a jour le bouton s'il y a des variantes du produit, en fonction du retour de l'API avec l'info limited, le nb de variantes et le drapeau du pays
            function changeButtonProductPlus(item, limited = 0, nb_variations = 0, flag = null) {
                const isParent = item.querySelector('input').getAttribute('data-is-parent-asin') === 'true';
                var button = item.querySelector('.a-button-text');
                var newText = "";
                var showDetails = true;
                if (flag) {
                    newText = newText + flag + " ";
                    showDetails = false;
                }
                if (limited == '1') {
                    newText = newText + iconLimited + " ";
                    showDetails = false;
                }
                if (isParent && isParentEnabled && nb_variations > 1) {
                    newText = newText + iconVariant + " (" + nb_variations + ") ";
                    showDetails = false;
                } else if (isParent && isParentEnabled && nb_variations == 0) {
                    newText = newText + iconVariant + " ";
                    showDetails = false;
                }
                if (mobileEnabled || cssEnabled) {
                    if (showDetails) {
                        newText = newText + "Détails";
                    }
                } else {
                    newText = newText + "Voir les détails";
                }
                button.innerHTML = newText;
            }

            function verifyToken(token) {
                return fetch(baseUrlPickme + `/shyrka/user/${token}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    }
                })
                    .then(response => response.text().then(text => {
                    return {status: response.status, statusText: response.statusText, responseText: text};
                }))
                    .catch(error => {
                    console.error(error);
                    throw error;
                });
            }

            async function verifyTokenPremiumPlus(token) {
                try {
                    const response = await fetch(baseUrlPickme + `/shyrka/userpremiumplus/${token}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        }
                    });

                    const text = await response.text();
                    return { status: response.status, statusText: response.statusText, responseText: text };
                } catch (error) {
                    console.error("Erreur dans verifyTokenPremiumPlus :", error);
                    throw error;
                }
            }

            async function verifyTokenPremium(token) {
                try {
                    const response = await fetch(baseUrlPickme + `/shyrka/userpremium/${token}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        }
                    });

                    const text = await response.text();
                    return { status: response.status, statusText: response.statusText, responseText: text };
                } catch (error) {
                    console.error("Erreur dans verifyTokenPremium :", error);
                    throw error;
                }
            }

            async function verifyTokenPlus(token) {
                try {
                    const response = await fetch(baseUrlPickme + `/shyrka/userplus/${token}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        }
                    });

                    const text = await response.text();
                    return { status: response.status, statusText: response.statusText, responseText: text };
                } catch (error) {
                    console.error("Erreur dans verifyTokenPlus :", error);
                    throw error;
                }
            }

            async function verifyTokenRole(token) {
                try {
                    const response = await fetch(baseUrlPickme + `/shyrka/userrole/${token}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        }
                    });

                    const text = await response.text();
                    return { status: response.status, statusText: response.statusText, responseText: text };
                } catch (error) {
                    console.error("Erreur dans verifyTokenRole :", error);
                    throw error;
                }
            }

            async function verifyTokenReco(token) {
                try {
                    const response = await fetch(baseUrlPickme + `/shyrka/userreco/${token}`, {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded",
                        }
                    });
                    const text = await response.text();
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        responseText: text
                    };
                } catch (error) {
                    console.error("Erreur dans verifyTokenReco :", error);
                    throw error;
                }
            }


            //Info serveur pour les commandes rapides
            function varFastCmd() {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                });

                return fetch(baseUrlPickme + "/shyrka/fastcmd", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                    .then(varData => {
                    const data = varData.data;
                    GM_setValue("fastCmdVar", data);
                    return { status: 200, responseText: JSON.stringify(varData) };
                })
                    .catch(error => {
                    throw error;
                });
            }

            async function askForToken(reason) {
                return new Promise(async (resolve, reject) => {
                    var userInput = prompt(`Votre clé API est ${reason}. Merci d'entrer une clé API valide:`);

                    if (userInput !== null) {
                        try {
                            var response = await verifyToken(userInput);
                            if (response && response.status === 200) {
                                //Save token after validation
                                GM_setValue('apiToken', userInput);
                                resolve(userInput);
                            } else if (response && response.status === 404) {
                                GM_deleteValue("apiToken");
                                alert("Clé API invalide !");
                                reject("Invalid API token");
                            } else {
                                GM_deleteValue("apiToken");
                                alert("Vérification de la clé échoué. Merci d'essayer plus tard.");
                                reject("Authorization failed");
                            }
                        } catch (error) {
                            GM_deleteValue("apiToken");
                            console.error("Error verifying API token:", error);
                            reject(error);
                        }
                    } else {
                        GM_deleteValue("apiToken");
                        reject("Error: User closed the prompt. A valid API token is required.");
                    }
                });
            }

            //Pickme add
            async function verifierCleAPI() {
                const cleAPI = GM_getValue("apiToken");
                if (!cleAPI) {
                    console.log("[PïckMe] Aucune clé API n'est configurée.");
                    return false;
                }
                try {
                    const reponse = await verifyToken(cleAPI);
                    if (reponse && reponse.status === 200) {
                        return true;
                    } else {
                        console.log("[PïckMe] La clé API est invalide.");
                        return false;
                    }
                } catch (erreur) {
                    console.error("Erreur lors de la vérification de la clé API:", erreur);
                    return false;
                }
            }
            //End

            function returnVariations() {
                var variations = {};

                document.querySelectorAll(`#vvp-product-details-modal--variations-container .vvp-variation-dropdown`).forEach(function(elem) {

                    const type = elem.querySelector('h5').innerText;
                    const names = Array.from(elem.querySelectorAll('.a-dropdown-container select option')).map(function(option) {
                        return option.innerText.replace(/[*_~|`]/g, '\\$&');
                    });
                    variations[type] = names;
                });
                return variations;
            }

            function generateCombinations(variations) {
                const variationKeys = Object.keys(variations);
                const variationValues = variationKeys.map(key => variations[key]);

                //Vérifier s'il y a au moins une variation avec des options
                if (variationValues.length === 0) {
                    return [];
                }

                //Fonction pour calculer le produit cartésien avec gestion des cas spéciaux
                function cartesianProduct(arrays) {
                    if (!arrays || arrays.length === 0) {
                        return [];
                    }
                    if (arrays.length === 1) {
                        //Retourner un tableau de tableaux pour maintenir la cohérence
                        return arrays[0].map(item => [item]);
                    }
                    return arrays.reduce((acc, curr) => {
                        return acc.flatMap(accItem => {
                            return curr.map(currItem => {
                                return [].concat(accItem, currItem);
                            });
                        });
                    });
                }

                const combinations = cartesianProduct(variationValues);

                //Transformer les combinaisons en objets avec les clés appropriées
                return combinations.map(combination => {
                    const comboObject = {};
                    combination.forEach((value, index) => {
                        comboObject[variationKeys[index]] = value;
                    });
                    return comboObject;
                });
            }

            function variationFormatting(variations) {
                var str = (Object.keys(variations).length > 1) ? ':arrow_down: Dropdowns' : ':arrow_down: Dropdown';
                for (const type in variations) {
                    const t = (variations[type].length > 1) ? `\n**${type.replace(/(y$)/, 'ie')}s (${variations[type].length}):** ` : `\n**${type}:** `; //plural, if multiple
                    str += t + variations[type].join(' ● ');
                }
                return str;
            }

            function noteFormatting(notes) {
                var str = (notes.length > 1) ? ':notepad_spiral: Notes' : ':notepad_spiral: Note';
                for (const item of notes) {
                    (item != null) ? str += `\n* ${item}` : null;
                }
                return str;
            }

            function countVariations(obj) {
                for (const key in obj) {
                    if (Array.isArray(obj[key]) && obj[key].length > 1) {
                        return false;
                    }
                }
                return true;
            }

            //PickMe Add
            //Compte le nombre de variations d'un objet
            function nbVariations(obj) {
                let total = 1;
                for (const key in obj) {
                    if (Array.isArray(obj[key]) && obj[key].length > 0) {
                        total *= obj[key].length;
                    }
                }
                return total;
            }
            //PickMe End

            function writeComment(productData) {
                var hasNoSiblings = countVariations(productData.variations);
                var comment = [];
                (productData.seller) ? comment.push(`Vendeur: ${productData.seller}`) : null;
                (productData.isLimited) ? comment.push(":hourglass: Limited") : null;
                (productData.variations) ? comment.push(variationFormatting(productData.variations)) : null;

                var notes = [];
                (productData.differentImages && hasNoSiblings) ? notes.push("Parent product photo might not reflect available child variant.") : null;
                notes = notes.filter(value => value !== null);
                (notes.length > 0) ? comment.push(noteFormatting(notes)) : null;

                if (comment.length > MAX_COMMENT_LENGTH) {
                    comment = truncateString(comment);
                }

                comment = comment.join('\n');
                comment = comment?.replace("\n", "\n\n");

                return comment;
            }

            //Quand on clic sur le bouton discord
            async function buttonHandler() {
                //Données pour transmissions
                var productData = {};
                let eltChildAsin = document.querySelector("a#vvp-product-details-modal--product-title");
                if (!eltChildAsin) {
                    eltChildAsin = document.querySelector("#product-details-sheet-title");
                }
                var childAsin = eltChildAsin.href.match(/amazon..+\/dp\/([A-Z0-9]+).*$/)[1];

                let childImage = document.querySelector("#vvp-product-details-modal--product-image") ||
                    document.querySelector('#vvp-product-details-modal--hero-image');
                if (!childImage) {
                    childImage = document.querySelector("#product-details-sheet-image");
                }
                var variations = returnVariations();
                productData.variations = (Object.keys(variations).length > 0) ? variations : null;
                let eltIsLimited = (document.querySelector('#vvp-product-details-modal--limited-quantity'));
                if (eltIsLimited) {
                    productData.isLimited = (eltIsLimited.style.display !== 'none');
                } else {
                    //Information inaccessible en mobile
                    productData.isLimited = false;
                }

                productData.asin = parentAsin;
                productData.enrollment = parentEnrollment;
                productData.differentChild = (parentAsin !== childAsin); //comparing the asin loaded in the modal to the one on the webpage
                productData.differentImages = (parentImage !== childImage.src?.match(PRODUCT_IMAGE_ID)[1]);
                let eltEtv = document.querySelector("#vvp-product-details-modal--tax-value-string");
                if (eltEtv) {
                    productData.etv = document.querySelector("#vvp-product-details-modal--tax-value-string")?.innerText.replace("€", "");
                } else {
                    //Sélecteur précis pour éviter les erreurs d'ETV (mais risque de changer plus souvent)
                    eltEtv = document.querySelector('#product-details-sheet-tax-value-string');
                    productData.etv = eltEtv ? eltEtv.innerText.replace("€", "") : "0";
                }

                productData.queue = queueType;
                let eltSeller = document.querySelector("#vvp-product-details-modal--by-line");
                if (eltSeller) {
                    productData.seller =  eltSeller.innerText.replace(/^par /, '');
                } else {
                    productData.seller = 'Inconnu (partage mobile)';
                }
                //productData.comments = writeComment(productData);

                const response = await sendDataToAPI(productData);

                var listOfItems = GM_getValue('config');
                //Test pour supprimer un partage
                //const asintest = "B0D25RX87G";
                //listOfItems[asintest] = {};

                if (response) {
                    if (response.status == 200) {
                        listOfItems[productData.asin] = {};
                        listOfItems[productData.asin].status = 'Posted';
                        listOfItems[productData.asin].queue = productData.queue;
                        listOfItems[productData.asin].date = new Date().getTime();
                        GM_setValue('config', listOfItems);
                        updateButtonIcon(2);
                        //PickMe add
                    } else if (response.status == 201) {
                        listOfItems[productData.asin] = {};
                        listOfItems[productData.asin].status = 'Posted';
                        listOfItems[productData.asin].queue = productData.queue;
                        listOfItems[productData.asin].date = new Date().getTime();
                        GM_setValue('config', listOfItems);
                        updateButtonIcon(4);
                        //End
                    } else if (response.status == 400 || response.status == 401) { //invalid token
                        updateButtonIcon(5);
                        //Will prompt the user to enter a valid token
                        askForToken("manquante/invalide").then((value) => {
                            API_TOKEN = value;
                            buttonHandler(); //retry the API request
                        }).catch((error) => {
                            console.error(error);
                        });
                    } else if (response.status == 422) { //incorrect parameters (API might have been updated) or posting is paused
                        updateButtonIcon(6);
                    } else if (response.status == 429) { //too many requests
                        updateButtonIcon(3);
                        //PickMe add
                    } else if (response.status == 423) { //Ancien produit
                        listOfItems[productData.asin] = {};
                        listOfItems[productData.asin].status = 'Posted';
                        listOfItems[productData.asin].queue = productData.queue;
                        listOfItems[productData.asin].date = new Date().getTime();
                        GM_setValue('config', listOfItems);
                        updateButtonIcon(7);
                    }
                    //End
                }

            }

            let productDetailsModal;

            function updateButtonPosition() {
                const button = document.querySelector('.a-button-discord');
                const container = productDetailsModal;

                //check the size of the modal first before determining where the button goes
                /*if (container.offsetWidth < container.offsetHeight) {
                //the See Details modal is taller, so moving it toward the bottom
                button.classList.add('mobile-vertical');
                button.parentElement.appendChild(button);
            } else {
                //revert to the original button placement
                button.classList.remove('mobile-vertical');
                button.parentElement.prepend(button);
            }*/
                button.classList.remove('mobile-vertical');
                button.parentElement.prepend(button);
                button.removeElement;
                button.addEventListener("click", buttonHandler);
            }

            //Distinguishes the correct modal since Amazon doesn't distinguish them at all
            function getCorrectModal() {
                var btnHeaders = document.querySelectorAll('.vvp-modal-footer');
                if (btnHeaders.length > 0) {
                    var filteredHeaders = Array.from(btnHeaders).map(function (modal) {
                        var productDetailsHeader = modal.parentElement.parentElement.querySelector('.a-popover-header > .a-popover-header-content');
                        //PickMe edit
                        if (productDetailsHeader && productDetailsHeader.innerText.trim() === "Détails de l'article") {
                            //End
                            return [modal, modal.parentElement.parentElement];
                        }
                        return null;
                    });

                    filteredHeaders = filteredHeaders.filter(function (item) {
                        return item !== null;
                    });

                    return filteredHeaders[0];
                } else {
                    btnHeaders = document.querySelectorAll('#product-details-sheet-footer');
                    if (btnHeaders.length === 0) {
                        return null;
                    }

                    let isBoutonDemanderProduitPresent = btnHeaders[0].querySelector('#product-details-sheet-request-btn-announce, #product-details-sheet-request-btn-disabled-announce');

                    if (!isBoutonDemanderProduitPresent) {
                        return null;
                    }
                    return btnHeaders;
                }
            }

            //Initialiser le bouton
            function addShareButton() {
                var discordBtn = `<button class="a-button-discord a-button" style="align-items: center;"></button>`;
                var modalElems = getCorrectModal();

                if (!modalElems || !modalElems[0]) {
                    return;
                }

                modalElems[0].insertAdjacentHTML('afterbegin', discordBtn);
                var productDetailsModal = modalElems[1] || modalElems[0]; //fallback si [1] n’existe pas

                const resizeObserver = new ResizeObserver(updateButtonPosition);
                resizeObserver.observe(productDetailsModal);
            }

            function updateButtonIcon(type) {
                var discordBtn = document.querySelector('.a-button-discord');
                if (discordBtn) {
                    discordBtn.disabled = false;
                    discordBtn.classList.remove('a-button-disabled');

                    if (type == 0) { //Défaut
                        discordBtn.innerHTML = `${btn_discordSvg}<span class="a-button-text">Partager sur discord</span>`;
                        discordBtn.style.cursor = 'pointer';
                    } else if (type == 1) { //Bouton cliqué et attente du retour
                        discordBtn.innerHTML = `${btn_loadingAnim}<span class="a-button-text">Envoi en cours...</span>`;
                        discordBtn.disabled = true;
                        discordBtn.style.cursor = 'no-drop';
                    } else if (type == 2) { //API: success
                        discordBtn.innerHTML = `${btn_checkmark}<span class="a-button-text">OK</span>`;
                        discordBtn.disabled = true;
                        discordBtn.classList.add('a-button-disabled');
                    } else if (type == 3) { //API: trop rapide
                        discordBtn.innerHTML = `${btn_warning}<span class="a-button-text">Partage trop rapide !</span>`;
                        discordBtn.style.cursor = 'pointer';
                    } else if (type == 4) { //Déja posté
                        discordBtn.innerHTML = `${btn_info}<span class="a-button-text">Déjà posté</span>`;
                        discordBtn.disabled = true;
                        discordBtn.classList.add('a-button-disabled');
                        discordBtn.style.cursor = 'no-drop';
                    } else if (type == 5) { //API: clé invalide
                        discordBtn.innerHTML = `${btn_error}<span class="a-button-text">Clé API invalide</span>`;
                        discordBtn.disabled = true;
                        discordBtn.classList.add('a-button-disabled');
                        discordBtn.style.cursor = 'no-drop';
                    } else if (type == 6) { //API: paramètres invalides
                        discordBtn.innerHTML = `${btn_error}<span class="a-button-text">Erreur</span>`;
                        discordBtn.style.cursor = 'pointer';
                        //PickMe Edit
                    } else if (type == 7) { //API: paramètres invalides
                        discordBtn.innerHTML = `${btn_warning}<span class="a-button-text">Trop ancien</span>`;
                        discordBtn.disabled = true;
                        discordBtn.classList.add('a-button-disabled');
                        discordBtn.style.cursor = 'no-drop';
                    }
                }
                //End

            }

            //PickMe edit
            //[sluf] 02/07/25 : l'appel API /newproduct est lié uniquement au bouton de partage discord
            function sendDataToAPI(data) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    page: valeurPage,
                    tab: valeurQueue,
                    pn: valeurPn,
                    cn: valeurCn,
                    asin: data.asin,
                    enrollment: data.enrollment,
                    seller: data.seller,
                    isLimited: data.isLimited,
                    variations: JSON.stringify(data.variations),
                    etv: data.etv,
                    nb_variations: nbVariations(data.variations),
                });

                //End
                updateButtonIcon(1);

                return fetch(baseUrlPickme + "/shyrka/newproduct", {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    return response.text().then(text => {
                        console.log(response.status, text);
                        return {status: response.status, statusText: response.statusText, responseText: text};
                    });
                })
                    .catch(error => {
                    console.error(error);
                    updateButtonIcon(6);
                    throw error;
                });
            }

            //PickMe add
            if (urlPattern.test(window.location.href)) {
                //Fix iPhone
                if (document.readyState !== 'loading') {
                    addHomeTab();
                    addFavTab();
                    addTab();
                }
                else {
                    document.addEventListener('DOMContentLoaded', function () {
                        addHomeTab();
                        addFavTab();
                        addTab();
                    });
                }
            }

            function addFavTab() {
                if (window.location.href.startsWith("https://www.amazon.fr/vine/vine-items")) {
                    mesFavoris();
                }
            }

            //Afficher l'onglet "Favoris"
            function mesFavoris() {
                const MAX_fS = 200; //Limite des favoris affichés

                if (apiKey && hideEnabled) {
                    //Ajouter un nouvel onglet dans le menu
                    const menu = document.querySelector(".a-tabs") || ensureMobileTabsContainer();
                    if (!menu) return;
                    const newTab = document.createElement('li');
                    newTab.className = 'a-tab-heading';
                    newTab.innerHTML = '<a href="javascript:void(0);" id="favorisTab" role="tab" aria-selected="false" tabindex="-1" style="color: #f8a103;">Favoris</a>';
                    menu.appendChild(newTab);

                    //Ajouter le conteneur pour afficher les favoris
                    const container = document.createElement('div');
                    container.id = 'favorisContainer';
                    container.style.display = 'none';
                    container.className = 'a-container vvp-body';
                    container.innerHTML = `
            <div class="a-box a-tab-content" role="tabpanel" tabindex="0">
                <div class="a-box-inner">
                    <div class="a-section vvp-tab-content">
                        <div class="vvp-orders-table--heading-top" style="display: flex; justify-content: space-between; align-items: center;">
                            <h3 id="favorisCount">Favoris (0)</h3>
                            <span class="a-button a-button-primary vvp-orders-table--action-btn">
                                <span class="a-button-inner">
                                    <button id="supprimerTousFavoris" class="a-button-input" aria-labelledby="supprimer-tous"></button>
                                    <span class="a-button-text" aria-hidden="true" id="supprimer-tous">Tout supprimer</span>
                                </span>
                            </span>
                        </div>
                        <table class="a-normal vvp-orders-table">
                            <thead>
                                <tr class="vvp-orders-table--heading-row">
                                    <th id="vvp-orders-table--image-col-heading"></th>
                                    <th id="vvp-orders-table--product-title-heading" class="vvp-orders-table--text-col aok-nowrap" style="padding-bottom: 15px;">Produit</th>
                                    <th id="vvp-orders-table--order-date-heading" class="vvp-orders-table--text-col aok-nowrap" style="padding-bottom: 10px;">Vu pour la dernière fois</th>
                                    <th id="vvp-orders-table--actions-col-heading"></th>
                                </tr>
                            </thead>
                            <tbody id="favorisList"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
                    document.querySelector('#a-page > div.a-container.vvp-body > div.a-tab-container.vvp-tab-set-container').appendChild(container);

                    //Ajouter du style pour l'espace au-dessus de la première ligne de produit
                    const style = document.createElement('style');
                    style.textContent = `
            tr:first-child td, tr:first-child th {
                padding-top: 15px;
            }
            #favorisContainer {
                padding: 0;
            }
            .a-tab-content {
                border-radius: 0 0 8px 8px;
            }
        `;
                    document.head.appendChild(style);

                    //Fonction pour afficher les favoris
                    async function afficherFavoris() {
                        const favorisList = document.getElementById('favorisList');
                        favorisList.innerHTML = ''; //Réinitialiser la liste des favoris

                        const favoris = [];
                        const listASINS = [];
                        const promises = Object.keys(localStorage).map(async (key) => {
                            if (key.endsWith('_f')) {
                                const favori = localStorage.getItem(key);
                                if (favori === '1') {
                                    const asin = key.split('_f')[0]; //Extraire l'ASIN de la clé
                                    listASINS.push("https://www.amazon.fr/dp/" + asin);
                                    try {
                                        const productInfo = await infoProduct(asin); //Appel à la fonction infoProduct avec l'ASIN
                                        const lastSeenDate = productInfo.date_last_eu ? parseEuropeanDate(productInfo.date_last_eu) : null;
                                        const timeDiff = lastSeenDate ? new Date() - lastSeenDate : 0;
                                        favoris.push({ asin, key, productInfo, timeDiff });
                                    } catch (error) {
                                        console.error("Erreur lors de la récupération des informations du produit:", error);
                                    }
                                }
                            }
                        });

                        await Promise.all(promises);

                        //Trier les favoris : ceux avec timeDiff = 0 en premier, puis par timeDiff croissant
                        favoris.sort((a, b) => {
                            if (a.timeDiff === 0) return -1;
                            if (b.timeDiff === 0) return 1;
                            return a.timeDiff - b.timeDiff;
                        });

                        //Limiter les favoris à MAX_fS
                        const favorisAffiches = favoris.slice(0, MAX_fS);

                        //Mettre à jour le titre avec le nombre de favoris affichés
                        document.querySelector('#favorisCount').textContent = `Favoris (${favorisAffiches.length})`;

                        //Fonction pour convertir une date européenne en format de date interprétable
                        function parseEuropeanDate(dateStr) {
                            const [day, month, year, hours, minutes, seconds] = dateStr.split(/[/ :]/);
                            return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
                        }

                        //Afficher les favoris triés
                        favorisAffiches.forEach(({ asin, key, productInfo, timeDiff }) => {
                            const tr = document.createElement('tr');
                            tr.className = 'vvp-orders-table--row';
                            const urlProduct = "https://www.amazon.fr/dp/" + asin;
                            const fallbackImage = baseUrlPickme + '/img/Pas-d-image-disponible-svg.png';
                            if (productInfo == "ASIN absent") {
                                tr.innerHTML = `
                        <td class="vvp-orders-table--image-col"><img alt="${asin}" src="${fallbackImage}"></td>
                        <td class="vvp-orders-table--text-col"><a class="a-link-normal" target="_blank" rel="noopener" href="${urlProduct}">Recommandation ou produit inconnu : ${asin}</a></td>
                        <td class="vvp-orders-table--text-col"><strong>N/A</strong></td>
                        <td class="vvp-orders-table--actions-col"><span class="a-button a-button-primary vvp-orders-table--action-btn" style="margin-left: 10px; margin-right: 10px;"><span class="a-button-inner"><button data-key="${key}" class="a-button-input supprimerFavori" aria-labelledby="supprimer-${key}">Supprimer</button><span class="a-button-text" aria-hidden="true" id="supprimer-${key}">Supprimer</span></span></span></td>
                    `;
                            } else if (!productInfo.main_image && productInfo.title) {
                                tr.innerHTML = `
                        <td class="vvp-orders-table--image-col"><img alt="${asin}" src="${fallbackImage}"></td>
                        <td class="vvp-orders-table--text-col"><a class="a-link-normal" target="_blank" rel="noopener" href="${urlProduct}">Produit indisponible : ${productInfo.title}</a></td>
                        <td class="vvp-orders-table--text-col"><strong>N/A</strong></td>
                        <td class="vvp-orders-table--actions-col"><span class="a-button a-button-primary vvp-orders-table--action-btn" style="margin-left: 10px; margin-right: 10px;"><span class="a-button-inner"><button data-key="${key}" class="a-button-input supprimerFavori" aria-labelledby="supprimer-${key}">Supprimer</button><span class="a-button-text" aria-hidden="true" id="supprimer-${key}">Supprimer</span></span></span></td>
                    `;
                            } else if (productInfo.title) {
                                //Vérifier la date et appliquer la couleur appropriée
                                let dateColor = '';

                                const hoursDiff = timeDiff / (1000 * 60 * 60);
                                const minutesDiff = timeDiff / (1000 * 60);

                                if (hoursDiff > parseFloat(favOld)) {
                                    if (colorblindEnabled) {
                                        dateColor = 'color: #E78AC3;'; //Rose magenta (alerte)
                                    } else {
                                        dateColor = 'color: #FF0000;'; //Rouge (alerte)
                                    }
                                } else if (minutesDiff < parseFloat(favNew)) {
                                    if (colorblindEnabled) {
                                        dateColor = 'color: #A6D854;'; //Vert clair/jaune-vert (activité récente)
                                    } else {
                                        dateColor = 'color: #007FFF;'; //Bleu (activité récente)
                                    }
                                }
                                tr.innerHTML = `
    <td class="vvp-orders-table--image-col">
        <img
            alt="${productInfo.title}"
            src="${productInfo.main_image}"
            onerror="this.onerror=null;this.src='${fallbackImage}'">
    </td>
    <td class="vvp-orders-table--text-col">
        <a class="a-link-normal" target="_blank" rel="noopener" href="${urlProduct}">
            ${productInfo.title}
        </a>
    </td>
    <td class="vvp-orders-table--text-col" style="${dateColor}">
        <strong>${productInfo.date_last_eu}</strong><br>
        <a class="a-link-normal" target="_blank" rel="noopener" href="${productInfo.linkUrl}">
            ${productInfo.linkText}
        </a>
    </td>
    <td class="vvp-orders-table--actions-col">
        <span class="a-button a-button-primary vvp-orders-table--action-btn" style="margin-left: 10px; margin-right: 10px;">
            <span class="a-button-inner">
                <button data-key="${key}" class="a-button-input supprimerFavori" aria-labelledby="supprimer-${key}">Supprimer</button>
                <span class="a-button-text" aria-hidden="true" id="supprimer-${key}">Supprimer</span>
            </span>
        </span>
    </td>
`;
                            }
                            favorisList.appendChild(tr);
                        });
                        ordersPostCmd(listASINS, "fav");
                        //Ajouter des écouteurs d'événement pour les boutons de suppression
                        document.querySelectorAll('.supprimerFavori').forEach(button => {
                            button.addEventListener('click', function() {
                                const key = this.getAttribute('data-key');
                                localStorage.removeItem(key);
                                const listItem = this.closest('tr');
                                if (listItem) {
                                    listItem.remove(); //Supprimer la ligne correspondante
                                }
                                //Mettre à jour le titre avec le nombre de favoris affichés
                                const nbFavorisRestants = document.querySelectorAll('#favorisList .vvp-orders-table--row').length;
                                document.querySelector('#favorisCount').textContent = `Favoris (${nbFavorisRestants})`;
                            });
                        });
                    }

                    //Fonction pour supprimer tous les favoris
                    function supprimerTousLesFavoris() {
                        if (confirm('Êtes-vous sûr de vouloir supprimer tous les favoris ?')) {
                            Object.keys(localStorage).forEach(key => {
                                if (key.endsWith('_f')) {
                                    localStorage.removeItem(key);
                                }
                            });
                            afficherFavoris(); //Rafraîchir la liste des favoris
                        }
                    }

                    //Ajouter le gestionnaire d'événement pour le bouton "Supprimer tous les favoris"
                    document.getElementById('supprimerTousFavoris').addEventListener('click', supprimerTousLesFavoris);

                    //Afficher le conteneur des favoris lors du clic sur le nouvel onglet
                    document.getElementById('favorisTab').addEventListener('click', function() {
                        document.querySelectorAll('.a-tab-heading').forEach(tab => {
                            tab.classList.remove('a-active');
                        });
                        this.parentElement.classList.add('a-tab-heading', 'a-active');
                        this.setAttribute('aria-selected', 'true');
                        document.querySelectorAll('.a-box-tab').forEach(box => {
                            box.style.display = 'none';
                        });
                        container.style.display = 'block';
                        afficherFavoris();
                    });
                }
            }

            //Pour trouver le status actuel du checkout, ancien ou nouveau
            function getCheckoutStatus() {
                const script = document.querySelector('script[data-a-state*="vvp-context"]');
                if (script) {
                    try {
                        const data = JSON.parse(script.textContent);
                        if (data.isCheckoutEnabled === true || data.isCheckoutEnabled === "true") {
                            checkoutEnabled = true;
                        }
                    } catch (e) {
                        console.error("Erreur getCheckoutStatus :", e);
                    }
                }
                if (apiOk && showCheckout) {
                    let container;
                    if (isMobile()) {
                        container = document.getElementById('categories-sheet-content');
                    } else {
                        container = document.getElementById('vvp-browse-nodes-container');
                    }
                    if (container) {
                        //Injecter les styles si pas déjà présents
                        if (!document.getElementById('checkout-style')) {
                            const style = document.createElement('style');
                            style.id = 'checkout-style';
                            style.textContent = `
					.checkout-status {
						margin: 8px 0 12px;
						padding: 6px 10px;
						border-radius: 6px;
						background-color: #f4f4f4;
						font-size: 14px;
						color: #333;
						display: inline-block;
						border: 1px solid #ddd;
					}

					.checkout-status .label {
						font-weight: 500;
						color: #555;
						margin-right: 6px;
					}

					.checkout-status .value {
						font-weight: bold;
					}

					.checkout-status .value.nouveau {
						color: #007a3d;
					}

					.checkout-status .value.ancien {
						color: #b35a00;
					}
                  `;
                            document.head.appendChild(style);
                        }

                        //Créer le bloc "Processus de commande"
                        const checkoutContainer = document.createElement('div');
                        checkoutContainer.className = 'checkout-status';

                        const label = document.createElement('span');
                        label.className = 'label';
                        label.textContent = 'Processus de commande :';

                        const value = document.createElement('span');
                        value.className = 'value ' + (checkoutEnabled ? 'nouveau' : 'ancien');
                        value.textContent = checkoutEnabled ? 'Nouveau' : 'Ancien';

                        checkoutContainer.appendChild(label);
                        checkoutContainer.appendChild(value);

                        //Insérer selon le contexte mobile / desktop
                        if (isMobile()) {
                            const showAllSection = container.querySelector('#categories-sheet-content .vvp-mobile-show-all');
                            if (showAllSection && showAllSection.parentNode) {
                                showAllSection.parentNode.insertBefore(checkoutContainer, showAllSection);
                            }
                        }
                        else if (mobileEnabled && !isMobile()) {
                            const content = container.querySelector('.vvp-browse-nodes-content');
                            if (content) {
                                content.prepend(checkoutContainer);
                            }
                        } else {
                            const referenceNode = container.querySelector('p');
                            if (referenceNode) {
                                container.insertBefore(checkoutContainer, referenceNode);
                            } else {
                                container.appendChild(checkoutContainer);
                            }
                        }
                    }
                }
            }

            //Check du status checkout
            let checkoutEnabled = false;
            if (document.readyState !== 'loading') {
                getCheckoutStatus();
            }
            else {
                document.addEventListener('DOMContentLoaded', function () {
                    getCheckoutStatus();
                });
            }

            if (apiOk && window.location.href.startsWith("https://www.amazon.fr/vine/vine-items?queue=")) {
                //Appeler la fonction pour afficher les commandes
                if (ordersStatsEnabled || statsEnabled) {
                    afficherInfos();
                }
            }

            function afficherInfos() {
                //Créer un tableau de promesses
                const promises = [];

                if (ordersStatsEnabled) {
                    //Ajouter qtyOrders() directement au tableau des promesses
                    const qtyOrdersPromise = qtyOrders();
                    promises.push(qtyOrdersPromise);

                    if (statsEnabled) {
                        //Lancer qtyProducts après le lancement de qtyOrders, sans attendre sa résolution
                        const qtyProductsPromise = qtyOrdersPromise.then(() => qtyProducts());
                        promises.push(qtyProductsPromise);
                    }
                } else if (statsEnabled) {
                    //Si ordersStatsEnabled est faux, lancer qtyProducts directement
                    promises.push(qtyProducts());
                }

                //Attendre que toutes les promesses soient résolues
                Promise.all(promises).then(() => {
                    //Afficher le conteneur une fois que toutes les données sont disponibles
                    const infoContainer = document.getElementById('info-container');
                    if (infoContainer) {
                        infoContainer.style.display = 'block';
                    }
                    //console.log("Toutes les informations ont été affichées.");
                }).catch((error) => {
                    console.error("Erreur lors de l'affichage des informations:", error);
                });
            }

            function sendDatasToAPI(data) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    products: JSON.stringify(data),
                    queue: valeurQueue,
                    page: valeurPage,
                    pn: valeurPn,
                    cn: valeurCn,
                });

                return fetch(baseUrlPickme + "/shyrka/newproducts", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (!response.ok) {
                        //En cas d’erreur HTTP on récupère quand même le corps pour debug
                        return response.text().then(txt => Promise.reject(new Error(txt)));
                    }
                    //Ici on s’attend à de l’JSON : le tableau des URL insérées
                    return response.json();
                })
                    .catch(error => {
                    throw error;
                });
            }

            function extractASIN(input) {
                //Expression régulière pour identifier un ASIN dans une URL ou directement
                const regex = /\/dp\/([A-Z0-9]{10})|([A-Z0-9]{10})/;
                const match = input.match(regex);
                if (match) {
                    return match[1] || match[2];
                }
                return null;
            }

            //Test si un asin fait 10 caractères, pour éviter les faux asin fait avec timestampToAsin
            function isAsin(asin) {
                return typeof asin === 'string' && asin.length === 10;
            }

            //Avec le timestamp on cherche une commande
            function chercherOrderAvecTimestamp(timeStamp) {
                const resultats = null;

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);

                    if (key.startsWith("order_")) {
                        const valeur = localStorage.getItem(key);

                        if (valeur && valeur.includes(String(timeStamp))) {
                            return key;
                        }
                    }
                }

                return resultats;
            }

            //Remonte les commandes sur le serveur, au cas ou on ne les a pas
            function saveOrders() {
                if (window.location.href.includes('orders')) {
                    if (isMobile()) {
                        //On met en gras l'ETV sur mobile
                        document.querySelectorAll('.vvp-mobile-fair-market-value span').forEach(span => {
                            span.style.fontWeight = 'bold';
                        });
                        //On enlève le gras du nom du produit pour harmoniser avec l'onglet Avis
                        document.querySelectorAll('.vvp-order-product-title--non-link').forEach(el => {
                            el.style.fontWeight = 'normal';
                        });
                    }
                    const listASINS = [];
                    //Extraction des données de chaque ligne de produit
                    document.querySelectorAll('.vvp-orders-table--row').forEach(row => {
                        let productUrl = row.querySelector('.vvp-orders-table--text-col a');
                        let asin = null;
                        if (productUrl) {
                            productUrl = productUrl.href;
                            asin = extractASIN(productUrl);
                        } else {
                            let asinOrder = extractAsinFromOrderItem(row);
                            if (asinOrder) {
                                asin = asinOrder;
                            }
                        }
                        //On ajoute chaque asin à la liste pour appeler les infos de commandes seulement si c'est un vrai ASIN et non un timestamp
                        if (isAsin(asin)) {
                            const url = "https://www.amazon.fr/dp/" + asin;
                            listASINS.push(url);
                            //Sur mobile, on rend le nom du produit cliquable
                            if (isMobile()) {
                                if (isAsin(asin)) {
                                    const url = "https://www.amazon.fr/dp/" + asin;
                                    listASINS.push(url);

                                    // Cibler le conteneur du nom (exemple via un sélecteur ou ID spécifique)
                                    const titleContainer = row.querySelector('.vvp-order-product-title--non-link');

                                    // Créer le lien
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.target = '_blank';
                                    link.rel = 'noopener';
                                    link.textContent = titleContainer.textContent.trim();

                                    // Nettoyer et insérer
                                    titleContainer.innerHTML = '';
                                    titleContainer.appendChild(link);
                                }

                            }
                        }
                        //Sur mobile on ne va pas plus loin
                        const timestampElement = row.querySelector('[data-order-timestamp]');
                        const timestamp = timestampElement.getAttribute('data-order-timestamp');
                        const date = new Date(parseInt(timestampElement.getAttribute('data-order-timestamp')));
                        const year = date.getFullYear();
                        const month = ('0' + (date.getMonth() + 1)).slice(-2); //les mois sont indexés à partir de 0
                        const day = ('0' + date.getDate()).slice(-2);
                        const hours = ('0' + date.getHours()).slice(-2);
                        const minutes = ('0' + date.getMinutes()).slice(-2);
                        const seconds = ('0' + date.getSeconds()).slice(-2);
                        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                        const imageUrl = row.querySelector('.vvp-orders-table--image-col img').src;
                        let productName = "Indispo";
                        if (!isMobile()) {
                            productName = row.querySelector('.vvp-orders-table--text-col a .a-truncate-full')?.textContent.trim();
                        }

                        //Si pas d'asin, on stocke tout de meme les infos pour faire le lien plus tard via la page avis
                        if (!asin) {
                            const orderTimestamp = chercherOrderAvecTimestamp(timestamp);
                            if (!orderTimestamp) {
                                asin = timestamp;
                            }
                        }

                        //Doublon RR pour enregistrer le numéro de commande dans le localstorage car on s'en sert maintenant
                        const orderDate = timestampElement ? new Date(parseInt(timestampElement.getAttribute('data-order-timestamp'))).toLocaleDateString("fr-FR") : null;
                        const orderDetailsUrl = row.querySelector('.vvp-orders-table--action-btn a').href;
                        const orderId = extractOrderId(orderDetailsUrl);
                        const key_asin = "order_" + asin;

                        let etv;
                        if (isMobile()) {
                            etv = row.querySelector('.vvp-mobile-fair-market-value span')?.textContent.trim();
                        } else {
                            etv = row.querySelector('.vvp-orders-table--text-col.vvp-text-align-right')?.textContent.trim();
                        }

                        //Préparation de l'objet à stocker
                        const productData = {
                            productName,
                            imageUrl,
                            orderDate,
                            timestamp,
                            etv,
                            orderId
                        };

                        //Stockage dans localStorage avec l'ASIN comme clé que si on est pas sur mobile ou qu'il n'existe pas car sur mobile il manquera le nom du produit
                        if (localStorage.getItem(key_asin) === null || !isMobile()) {
                            localStorage.setItem(key_asin, JSON.stringify(productData));
                        }
                        //Fin doublon RR
                        if (!isAsin(asin)) {
                            return;
                        }
                        let formData = new URLSearchParams({
                            version: version,
                            token: API_TOKEN,
                            asin: asin,
                            date: formattedDate,
                            etv: etv,
                            imageUrl: imageUrl,
                            title: productName,
                        });

                        if (ordersEnabled) {
                            let buttonDetails = row.querySelector('.vvp-orders-table--action-btn');
                            if (isMobile()) {
                                const buttonDetails = row.querySelector('.vvp-orders-table--order-details-btn');
                            }
                            //Crée le bouton Annuler dans un conteneur span pour imiter le style du bouton "Détails"
                            const buttonContainer = document.createElement('span');
                            buttonContainer.classList.add('a-button', 'a-button-base', 'vvp-orders-table--action-btn', 'canceled-button');
                            buttonContainer.style.marginTop = '5px';

                            const buttonInner = document.createElement('span');
                            buttonInner.classList.add('a-button-inner');

                            const cancelButton = document.createElement('button');
                            cancelButton.classList.add('a-button-text');
                            cancelButton.textContent = 'Annuler';
                            cancelButton.style.width = '100%';
                            cancelButton.style.height = '100%';
                            cancelButton.style.border = 'none';
                            cancelButton.style.background = 'none';
                            //buttonInner.style.background = '#28a745';
                            cancelButton.style.padding = '5px !important';
                            cancelButton.style.cursor = 'pointer';

                            buttonInner.appendChild(cancelButton);
                            buttonContainer.appendChild(buttonInner);

                            let formDataCancel = new URLSearchParams({
                                version: version,
                                token: API_TOKEN,
                                asin: asin,
                            });

                            fetch(baseUrlPickme + "/shyrka/infocancel", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded"
                                },
                                body: formDataCancel.toString()
                            })
                                .then(response => {
                                if (!response.ok) {
                                    throw new Error("Erreur réseau : " + response.status);
                                }
                                return response.text();
                            })
                                .then(responseText => {
                                if (responseText === "true") {
                                    cancelButton.textContent = 'Intégrer';
                                    buttonDetails.style.background = '#dc3545';
                                } else {
                                    cancelButton.textContent = 'Annuler';
                                    buttonDetails.style.background = '#28a745';
                                }
                            })
                                .catch(error => {
                                console.error("Erreur lors de la requête :", error);
                            });

                            cancelButton.addEventListener('click', (event) => {
                                event.preventDefault();
                                const isCancelled = cancelButton.textContent.includes('Intégrer');
                                const newStatus = isCancelled ? 'uncancel' : 'cancel';
                                fetch(baseUrlPickme + "/shyrka/switchcancel", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/x-www-form-urlencoded"
                                    },
                                    body: formDataCancel.toString()
                                })
                                    .then(response => {
                                    //On vérifie le statut de la réponse
                                    if (!response.ok) {
                                        throw new Error(`Network response was not ok (status: ${response.status})`);
                                    }
                                    return response.text(); //ou response.json() si la réponse est au format JSON
                                })
                                    .then(data => {
                                    const greenCircle = row.querySelector('span:nth-of-type(1)');
                                    let greenCount = parseInt(greenCircle.textContent);

                                    if (isCancelled) {
                                        cancelButton.textContent = 'Annuler';
                                        buttonDetails.style.background = '#28a745';
                                        if (ordersInfos && Number.isInteger(greenCount)) {
                                            greenCircle.textContent = greenCount + 1;
                                        }
                                    } else {
                                        cancelButton.textContent = 'Intégrer';
                                        buttonDetails.style.background = '#dc3545';
                                        if (ordersInfos && Number.isInteger(greenCount) && greenCount > 0) {
                                            greenCircle.textContent = greenCount - 1;
                                        }
                                    }

                                    //'data' contient le contenu de la réponse (si besoin)
                                    //console.log(data);
                                })
                                    .catch(error => {
                                    console.error(error);
                                });
                            });

                            //Ajoute le bouton Annuler sous le bouton Détails
                            const actionCol = row.querySelector('.vvp-orders-table--actions-col');
                            if (actionCol) {
                                actionCol.appendChild(buttonContainer);
                            }
                            if (!isMobile()) {
                                fetch(baseUrlPickme + "/shyrka/orderlist", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/x-www-form-urlencoded"
                                    },
                                    body: formData.toString()
                                })
                                    .then(response => {
                                    if (!response.ok) {
                                        throw new Error("Erreur réseau " + response.status);
                                    }
                                    return response.text();
                                })
                                    .then(data => {
                                    console.log("[PïckMe] Réponse du serveur :", data);
                                })
                                    .catch(error => {
                                    console.error("Erreur lors de la requête :", error);
                                });
                            }
                        }
                    });

                    if (ordersInfos && ordersEnabled) {
                        ordersPostCmd(listASINS, "orders");
                        if (ordersPercent) {
                            ordersPostPercent(listASINS);
                        }
                    }
                }
            }

            //Récupérer le numéro de commande à partir de la clé de stockage
            function getOrderIdFromLocalStorage(key) {
                const data = localStorage.getItem(key);

                if (!data) return null;

                try {
                    const obj = JSON.parse(data);
                    return obj.orderId || null;
                } catch (e) {
                    console.error("Erreur lors du parsing JSON de la clé :", key, e);
                    return null;
                }
            }

            //Affiche les "boules" sur les avis
            function reviewOrders() {
                if (window.location.href.includes('vine-reviews')) {
                    const listASINS = [];
                    //Extraction des données de chaque ligne de produit
                    document.querySelectorAll('.vvp-reviews-table--row').forEach(row => {
                        let productUrl = row.querySelector('.vvp-reviews-table--text-col a');
                        const timestampElement = row.querySelector('[data-order-timestamp]');
                        const timestamp = timestampElement.getAttribute('data-order-timestamp');
                        let asin;
                        if (productUrl) {
                            productUrl = productUrl.href;
                            asin = extractASIN(productUrl);
                        } else {
                            //Le produit existe plus
                            const asinElement = row.querySelector('.vvp-reviews-table--text-col');
                            asin = asinElement ? asinElement.childNodes[0].nodeValue.trim() : null;
                        }
                        //On ajoute chaque asin à la liste pour appeler les infos de commandes
                        listASINS.push("https://www.amazon.fr/dp/" + asin);
                    });
                    if (ordersInfos && ordersEnabled) {
                        if (statsInReviews) {
                            ordersPostCmd(listASINS, "reviews");
                        }
                        if (ordersPercent) {
                            ordersPostPercent(listASINS);
                        }

                    }
                }
            }

            function convertOrderFromReview() {
                if (window.location.href.includes('vine-reviews')) {
                    //Correction du mot sur la page
                    var element = document.querySelector('#vvp-reviews-button--completed a.a-button-text');

                    //Vérifie si l'élément existe et si son texte est "Vérifiées"
                    if (element && element.textContent.trim() === "Vérifiées") {
                        //Modifie le texte en "Vérifiés"
                        element.textContent = "Vérifiés";
                    }
                    document.querySelectorAll('.vvp-reviews-table--row').forEach(row => {
                        let asin;
                        let productUrl = row.querySelector('.vvp-reviews-table--text-col a');
                        if (productUrl) {
                            productUrl = productUrl.href;
                            asin = extractASIN(productUrl);
                            const timestampElement = row.querySelector('[data-order-timestamp]');
                            const timestamp = timestampElement.getAttribute('data-order-timestamp');
                            const key_asin = "order_" + asin;
                            if (localStorage.getItem(key_asin) === null) {
                                const key_asin_timestamp = "order_" + timestamp;
                                if (localStorage.getItem(key_asin_timestamp) !== null) {

                                    const orderDate = timestampElement ? new Date(parseInt(timestampElement.getAttribute('data-order-timestamp'))).toLocaleDateString("fr-FR") : null;
                                    const orderId = getOrderIdFromLocalStorage(key_asin_timestamp);
                                    const productName = "Indispo";
                                    const imageUrl = baseUrlPickme + "/img/Pas-d-image-disponible-svg.png";
                                    const etv = "0.00";
                                    const productData = {
                                        productName,
                                        imageUrl,
                                        orderDate,
                                        timestamp,
                                        etv,
                                        orderId
                                    };

                                    //Stockage dans localStorage avec l'ASIN comme clé
                                    localStorage.setItem(key_asin, JSON.stringify(productData));
                                    localStorage.removeItem(key_asin_timestamp);
                                }
                            }
                        }
                    });
                }
            }

            //On sauvegarde les commandes en local et on envoi au serveur si ordersEnabled est activé
            saveOrders();
            //Utile pour mobile, si on va sur les avis, on en profite pour retrouver les ASIN pour la page des Commandes car l'ASIN n'y est plus, on recherche via le timestamp
            convertOrderFromReview();
            if (ordersInfos) {
                reviewOrders();
            }

            function ordersPost(data) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    urls: JSON.stringify(data),
                    queue: valeurQueue,
                });

                return fetch(baseUrlPickme + "/shyrka/asinsinfo", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                    .then(productsData => {
                    showOrders(productsData);
                    return productsData;
                })
                    .catch(error => {
                    //console.error(error);
                    throw error;
                })
                    .finally(() => {
                    //On signifie que le script a fini son action la plus "longue" pour les actions de fin
                    if (!autohideEnabled) {
                        allFinish = true;
                    }
                });
            }

            function ordersPostCmd(data, tab = "orders") {
                var apiURL = baseUrlPickme + "/shyrka/asinsinfocmd";
                if (tab === "fav") {
                    apiURL = baseUrlPickme + "/shyrka/asinsinfofav";
                }
                if (Array.isArray(data) && data.length > 0) {
                    const formData = new URLSearchParams({
                        version: version,
                        token: API_TOKEN,
                        urls: JSON.stringify(data),
                    });

                    return fetch(apiURL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formData.toString()
                    })
                        .then(response => {
                        if (!response.ok) {
                            throw new Error(`Error: ${response.status} ${response.statusText}`);
                        }
                        return response.json();
                    })
                        .then(productsData => {
                        showOrdersCmd(productsData, tab);
                        return productsData;
                    })
                        .catch(error => {
                        throw error;
                    });
                }

            }

            function ordersPostPercent(data) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                    urls: JSON.stringify(data),
                });

                return fetch(baseUrlPickme + "/shyrka/asinsinfocmdpercent", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (!response.ok) {
                        throw new Error(`Error: ${response.status} ${response.statusText}`);
                    }
                    return response.json();
                })
                    .then(productsData => {
                    showOrdersPercent(productsData);
                    return productsData;
                })
                    .catch(error => {
                    throw error;
                });
            }

            if (ordersInfos && flagEnabled) {
                const cssFlagUrl = 'https://emoji-css.afeld.me/emoji.css';
                const linkElement = document.createElement('link');
                linkElement.href = cssFlagUrl;
                linkElement.rel = 'stylesheet';
                linkElement.type = 'text/css';

                document.head.appendChild(linkElement);
            }

            function getFlag(countryCode) {
                if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
                    return '';
                }
                const lowerCaseCode = countryCode.toLowerCase();
                const upperCaseCode = countryCode.toUpperCase();
                return `<i class="em em-flag-${lowerCaseCode} custom-flag" aria-role="presentation" aria-label="${upperCaseCode}"></i>`;
            }

            //Pour afficher les commandes, l'etv, si c'est limité et les variations
            function showOrders(data) {
                const items = document.querySelectorAll('.vvp-item-tile');
                if (items.length === 0) return;

                items.forEach(item => {
                    const asin = item.getAttribute('data-asin') || item.querySelector('.'+getStringDetailsBtnSelector()+' input').getAttribute('data-asin');
                    const image = item.querySelector('.vvp-item-tile-content img');
                    const url = "https://www.amazon.fr/dp/" + asin;
                    const orderData = data.find(d => d.url === url);
                    if (!orderData) return;
                    const flagCountry = getFlag(orderData.flag);
                    if (!flagETV && flagEnabled) {
                        changeButtonProductPlus(item, orderData.limited, orderData.nb_variations, flagCountry);
                    } else {
                        changeButtonProductPlus(item, orderData.limited, orderData.nb_variations);
                    }
                    //Le conteneur de l'image (pour le positionnement relatif)
                    let wrapper = image.parentNode;
                    if (!wrapper.classList.contains('image-wrapper')) {
                        const newWrapper = document.createElement('div');
                        newWrapper.classList.add('image-wrapper');
                        newWrapper.style.position = 'relative';
                        newWrapper.style.display = 'inline-block';
                        //Insertion du nouveau wrapper à la place de l'image, puis déplacement de l'image dedans
                        wrapper.insertBefore(newWrapper, image);
                        newWrapper.appendChild(image);
                        wrapper = newWrapper;
                    }
                    if (!onlyETV) {
                        item.style.position = 'relative';

                        const iconSources = {
                            success: ballUrlSuccess,
                            error: ballUrlError
                        };

                        //Définition des tailles et marges
                        const iconSize = (mobileEnabled || cssEnabled) ? ballSizeMobile : ballSize;
                        const fontSize = (mobileEnabled || cssEnabled) ? ballFontMobile : ballFont;
                        const horPadding = (mobileEnabled || cssEnabled) ? ballHorizontalMobile : ballHorizontal ;
                        const vertPadding = (mobileEnabled || cssEnabled) ? ballVerticalMobile : ballVertical;

                        ['success', 'error'].forEach(type => {
                            const icon = document.createElement('img');
                            icon.setAttribute('src', iconSources[type]);

                            //Calcul de la position verticale :
                            const verticalPos = `bottom: ${vertPadding};`

                            //Calcul de la position horizontale :
                            const horizontalPos = type === 'success'
                            ? `left: ${horPadding};`
                            : `right: ${horPadding};`;

                            icon.style.cssText = `
                            position: absolute;
                            ${verticalPos}
                            ${horizontalPos}
                            cursor: pointer;
                            width: ${iconSize};
                            height: ${iconSize};
                            z-index: 10;
                        `;

                            //Création du texte indiquant le nombre
                            const count = document.createElement('span');
                            count.textContent = type === 'success' ? orderData.qty_orders_success : orderData.qty_orders_failed;
                            count.style.cssText = `
                            position: absolute;
                            ${verticalPos}
                            ${horizontalPos}
                            width: ${iconSize};
                            height: ${iconSize};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: ${fontSize};
                            font-weight: bold;
                            z-index: 20;
                        `;

                            //Ajout dans le conteneur de l'image pour que le positionnement soit relatif à celle-ci
                            wrapper.appendChild(icon);
                            wrapper.appendChild(count);
                        });
                    }
                    //Pour l'étiquette affichant le montant (placée au centre en bas de l'image)
                    if ((showPrice && (orderData.etv_real !== null || orderData.price !== null)) ||
                        (!showPrice && orderData.etv_real !== null)) {
                        let fontSizeTime = etvFont;
                        let horizontalTime = etvHorizontal;
                        let verticalTime = etvVertical;
                        if (cssEnabled || mobileEnabled) {
                            fontSizeTime = etvFontMobile;
                            horizontalTime = etvHorizontalMobile;
                            verticalTime = etvVerticalMobile;
                        }

                        const etvRealDiv = document.createElement('div');
                        let displayHTML = "";
                        //On extrait en début de bloc pour alléger les appels
                        const { etv_real: etvReal, price } = orderData;

                        //On prépare les attributs data-* du wrapper
                        const wrapperAttrs = `class="order-item" data-price=${price !== null ? price : ''} data-etv=${etvReal !== null ? etvReal : ''}`;

                        if (mobileEnabled || cssEnabled) {
                            if (showPrice) {
                                if (etvReal !== null) {
                                    if (etvReal === "0.00") {
                                        if (price !== null) {
                                            displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconPrice}</span>` : ''}<span>${price}€</span><br><span>${iconETV}</span><span style="color: red;">${etvReal}€</span></div>`;
                                        } else {
                                            displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconETV}</span><br>` : ''}<span style="color: red;">${etvReal}€</span></div>`;
                                        }
                                    } else {
                                        if (price !== null) {
                                            displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconPrice}${iconETV}</span><br>` : ''}<span>${etvReal}€</span></div>`;
                                        } else {
                                            displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconETV}</span><br>` : ''}<span>${etvReal}€</span></div>`;
                                        }
                                    }
                                } else {
                                    if (price !== null) {
                                        displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconPrice}</span><br>` : ''}<span>${price}€</span></div>`;
                                    }
                                }
                            } else {
                                if (etvReal !== null) {
                                    displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconETV}</span><br>` : ''}<span${etvReal === "0.00" ? ' style="color: red;"' : ''}>${etvReal}€</span></div>`;
                                }
                            }
                        } else {
                            //Version “desktop”
                            if (showPrice) {
                                if (etvReal !== null) {
                                    if (etvReal === "0.00") {
                                        if (price !== null) {
                                            displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconPrice}</span>` : ''}<span>${price}€</span> / <span>${iconETV}</span><span style="color: red;">${etvReal}€</span></div>`;
                                        } else {
                                            displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconETV}</span>` : ''}<span style="color: red;">${etvReal}€</span></div>`;
                                        }
                                    } else {
                                        displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconPrice}${iconETV}</span>` : ''}<span>${etvReal}€</span></div>`;
                                    }
                                } else {
                                    displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconPrice}</span> <span>${price}€</span>` : `<span>${price}€ / N/A</span>`}</div>`;
                                }
                            } else {
                                displayHTML = `<div ${wrapperAttrs}>${showPriceIcon ? `<span>${iconETV}</span>` : ''}<span${etvReal === "0.00" ? ' style="color: red;"' : ''}>${etvReal}€</span></div>`;
                            }
                        }


                        //Ajouter le drapeau si flagEnabled et flagETV, et que flagCountry est renseigné
                        if (flagEnabled && flagETV && flagCountry) {
                            displayHTML = flagCountry + displayHTML;
                        }

                        etvRealDiv.innerHTML = displayHTML;

                        if (mobileEnabled || cssEnabled) {
                            etvRealDiv.style.cssText = `
            position: absolute;
            bottom: ${verticalTime};
            left: ${horizontalTime};
            transform: translateX(-50%);
            background-color: rgba(255, 255, 255, 0.7);
            color: black;
            padding: 1px 2px;
            border-radius: 5px;
            font-size: ${fontSizeTime};
            white-space: nowrap;
            z-index: 5;
            line-height: 1.2;
            text-align: center;
        `;
                        } else {
                            etvRealDiv.style.cssText = `
            position: absolute;
            bottom: ${verticalTime};
            left: ${horizontalTime};
            transform: translateX(-50%);
            background-color: rgba(255, 255, 255, 0.7);
            color: black;
            padding: 1px 2px;
            border-radius: 5px;
            font-size: ${fontSizeTime};
            white-space: nowrap;
            z-index: 5;
            text-align: center;
        `;
                        }
                        wrapper.appendChild(etvRealDiv);
                    }
                });
            }

            function findOrderId(orderId) {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);

                    //Vérifie si la clé commence par "order_"
                    if (key.startsWith('order_')) {
                        const value = localStorage.getItem(key);

                        //Vérifie si orderId est contenu dans la valeur (texte brut)
                        if (value && value.includes(orderId)) {
                            return { key, value };
                        }
                    }
                }
                return null;
            }

            function extractOrderId(url) {
                const match = url.match(/orderID=([0-9-]+)/);
                return match ? match[1] : null;
            }

            function extractAsinFromOrderItem(item) {
                //1. Récupère l'URL du bouton de détail de commande
                const link = item.querySelector('.vvp-orders-table--action-btn a');
                if (!link) return null;

                //2. Extrait l'orderId à partir de l'URL
                const orderDetailsUrl = link.href;
                const orderId = extractOrderId(orderDetailsUrl);
                if (!orderId) return null;

                //3. Cherche l'entrée correspondante dans le localStorage
                const infoOrderId = findOrderId(orderId);
                if (!infoOrderId || !infoOrderId.key?.startsWith('order_')) return null;

                //4. Extrait l’ASIN depuis la clé
                const asin = infoOrderId.key.slice(6); //ou split('order_')[1]
                return asin;
            }


            //Pour afficher les commandes réussies ou non dans la liste des commandes
            async function showOrdersCmd(data, tab = "orders") {
                if (tab == "fav") {
                    tab = "orders";
                }
                const items = document.querySelectorAll('.vvp-' + tab + '-table--row');
                if (items.length === 0) return;

                for (const item of items) {
                    const imageElement = item.querySelector('.vvp-' + tab + '-table--image-col img');
                    let productLink = item.querySelector('.vvp-' + tab + '-table--text-col a');
                    let url;

                    if (!productLink) {
                        if (!isMobile()) {
                            const asinElement = item.querySelector('.vvp-' + tab + '-table--text-col');
                            if (asinElement && asinElement.childNodes.length > 0 && asinElement.childNodes[0].nodeValue) {

                                let asin = asinElement ? asinElement.childNodes[0].nodeValue.trim() : null;
                                const productInfo = await infoProduct(asin);
                                if (productInfo && productInfo.title) {
                                    asinElement.childNodes[0].nodeValue = "(" + asin + ") " + productInfo.title || asin;
                                }
                                url = "https://www.amazon.fr/dp/" + asin;
                            } else {
                                let asin = extractAsinFromOrderItem(item);
                                if (asin) {
                                    url = "https://www.amazon.fr/dp/" + asin;
                                }
                            }
                        } else {
                            //Dans les avis sur mobile, on a l'asin, donc on le récupère
                            if (tab == "reviews") {
                                const asinElement = item.querySelector('.vvp-' + tab + '-table--text-col');
                                let asin = asinElement ? asinElement.childNodes[0].nodeValue.trim() : null;
                                const productInfo = await infoProduct(asin);
                                if (productInfo && productInfo.title) {
                                    asinElement.childNodes[0].nodeValue = "(" + asin + ") " + productInfo.title || asin;
                                }
                                url = "https://www.amazon.fr/dp/" + asin;
                                //Sur mobile dans les commandes, on a pas l'asin, on le cherche avec le numéro de commande
                            } else if (tab == "orders") {
                                let asin = extractAsinFromOrderItem(item);
                                if (asin) {
                                    url = "https://www.amazon.fr/dp/" + asin;
                                }
                            }
                        }
                    } else {
                        url = productLink.href;
                    }

                    if (!imageElement || !url) continue;

                    const orderData = data.find(d => d.url === url);
                    if (!orderData) continue;

                    const iconSources = {
                        success: ballUrlSuccess,
                        error: ballUrlError
                    };

                    const topValue = '70px';
                    const positions = `top: ${topValue};`;
                    const iconSize = '28px';
                    const fontSize = '14px';
                    let sidePadding = "0px";
                    let leftPadding = "11px";
                    if (tab == "reviews") {
                        sidePadding = mobileEnabled ? '30%' : '8px';
                        leftPadding = mobileEnabled ? '35%' : '8px';
                    } else {
                        sidePadding = mobileEnabled ? '31%' : '0px';
                        leftPadding = mobileEnabled ? '34%' : '11px';
                    }
                    ['success', 'error'].forEach(type => {
                        const icon = document.createElement('img');
                        icon.setAttribute('src', iconSources[type]);
                        icon.style.cssText = `position: absolute; ${positions} ${type === 'success' ? `left: ${leftPadding};` : `right: ${sidePadding};`} cursor: pointer; width: ${iconSize}; height: ${iconSize}; z-index: 10;`;

                        const count = document.createElement('span');
                        count.textContent = type === 'success' ? orderData.qty_orders_success : orderData.qty_orders_failed;
                        count.style.cssText = `position: absolute; ${positions} ${type === 'success' ? `left: ${leftPadding};` : `right: ${sidePadding};`} width: ${iconSize}; height: ${iconSize}; display: flex; align-items: center; justify-content: center; font-size: ${fontSize}; font-weight: bold; z-index: 20;`;

                        imageElement.parentElement.style.position = 'relative';
                        imageElement.parentElement.appendChild(icon);
                        imageElement.parentElement.appendChild(count);
                    });
                }
            }

            //Pour afficher les commandes réussies ou non dans la liste des commandes
            async function showOrdersPercent(data) {
                const items = document.querySelectorAll('.vvp-orders-table--row');
                if (items.length === 0) return;

                for (const item of items) {
                    const imageElement = item.querySelector('.vvp-orders-table--image-col img');
                    let productLink = item.querySelector('.vvp-orders-table--text-col a');
                    let url;

                    if (!productLink) {
                        //const asinElement = item.querySelector('.vvp-orders-table--text-col');
                        //let asin = asinElement ? asinElement.childNodes[0].nodeValue.trim() : null;
                        //url = "https://www.amazon.fr/dp/" + asin;
                        continue;
                    } else {
                        url = productLink.href;
                    }

                    if (!imageElement || !url) continue;

                    const orderData = data.find(d => d.url === url);
                    if (!orderData) continue;

                    const positions = mobileEnabled ? 'bottom: 10%;' : 'bottom: 10%;';
                    const iconSize = mobileEnabled ? '28px' : '28px';
                    const fontSize = mobileEnabled ? '14px' : '14px';
                    const sidePadding = mobileEnabled ? '30%' : '8px';

                    if (orderData.percentage !== null) {
                        const percent = document.createElement('span');
                        percent.textContent = orderData.percentage;
                        percent.style.cssText = `
        position: absolute;
        top: 5px;
        left: 50%;
        transform: translateX(-50%);
        padding: 2px 8px; /* Ajoute du padding pour le fond */
        background-color: rgba(255, 255, 255, 0.7); /* Fond transparent blanc */
        color: black;
        width: auto; /* La largeur s'adapte au contenu */
        height: auto; /* La hauteur s'adapte au contenu */
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${fontSize};
        z-index: 20;
        border-radius: 4px; /* Arrondir légèrement les coins du fond */
    `;
                        imageElement.parentElement.style.position = 'relative';
                        imageElement.parentElement.appendChild(percent);
                    }
                }
            }

            //Utilise les infos de RR pour avoir le nombre de commandes du jour
            function countOrdersToday() {
                const today = new Date().toLocaleDateString("fr-FR");
                let count = 0;

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('order_')) {
                        const order = JSON.parse(localStorage.getItem(key));
                        if (order.orderDate === today) {
                            count++;
                        }
                    }
                }
                return count;
            }

            function extractMonthYearFromDate(dateString) {
                const [day, month, year] = dateString.split('/').map(part => parseInt(part, 10));
                return { month: month - 1, year }; //mois est indexé à partir de 0 en JavaScript
            }

            //Utilise les infos de RR pour avoir le nombre de commandes du mois
            function countOrdersThisMonth() {
                const today = new Date();
                const currentMonth = today.getMonth(); //0-indexed month
                const currentYear = today.getFullYear();
                let count = 0;

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('order_')) {
                        const order = JSON.parse(localStorage.getItem(key));
                        if (order.orderDate) {
                            const { month, year } = extractMonthYearFromDate(order.orderDate);
                            if (month === currentMonth && year === currentYear) {
                                count++;
                            }
                        }
                    }
                }
                return count;
            }

            //Appel API pour synchroniser
            function syncProducts(askHide = true, hideAll = false, refresh = true) {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                });

                return fetch(baseUrlPickme + "/shyrka/sync", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (response.status === 401) {
                        alert("Clé API invalide ou membre non Premium+");
                        return response;
                    }

                    if (!response.ok) {
                        //Pour les autres statuts d'erreur
                        console.error("Erreur HTTP:", response.status, response.statusText);
                        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
                    }

                    //On tente de parser la réponse en JSON
                    return response.json().catch(error => {
                        console.error("Erreur lors du parsing JSON:", error);
                        throw error;
                    });
                })
                    .then(productsData => {
                    //Si on arrive ici, c'est qu'on a un code 2xx
                    syncProductsData(productsData, askHide, hideAll, refresh);
                    return productsData;
                })
                    .catch(error => {
                    console.error("Erreur de requête:", error);
                    throw error;
                });
            }

            //Appel API pour la quantité de produits
            function qtyProducts() {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                });

                return fetch(baseUrlPickme + "/shyrka/qtyproducts", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (response.status === 401) {
                        return response;
                    }

                    if (!response.ok) {
                        //Erreur HTTP (ex: 404, 500, etc.)
                        console.error("Erreur HTTP:", response.status, response.statusText);
                        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
                    }

                    //Réponse 2xx, on essaie de parser le JSON
                    return response.json().catch(error => {
                        console.error("Erreur lors du parsing JSON:", error);
                        throw error;
                    });
                })
                    .then(productsData => {
                    //On a réussi à parser le JSON, on appelle qtyProductsData
                    qtyProductsData(productsData);
                    return productsData;
                })
                    .catch(error => {
                    //Erreur réseau ou de parsing déjà gérée ci-dessus
                    console.error("Erreur de requête:", error);
                    throw error;
                });
            }

            //Affichage des données reçu par l'API, le délai est pour avoir le bon ordre d'affichage
            function qtyProductsData(productsData) {
                //Toujours créer le conteneur (même si déjà présent, il est réutilisé)
                const infoContainer = createInfoContainer();

                //Trouve ou crée le div pour les produits
                let productsDiv = document.getElementById('products-info');
                if (!productsDiv) {
                    productsDiv = document.createElement('div');
                    productsDiv.id = 'products-info';
                    productsDiv.style.padding = '0';
                    productsDiv.style.margin = '0';
                    infoContainer.appendChild(productsDiv);
                }

                let aiRecentHTML = '';
                if (productsData[0].ai_recent !== '0') {
                    aiRecentHTML = catGras
                        ? `<span style="color: green;"><strong> (+${productsData[0].ai_recent})</strong></span>`
                    : `<span style="color: green;"> (+${productsData[0].ai_recent})</span>`;
                }

                let afaRecentHTML = '';
                if (productsData[0].afa_recent !== '0') {
                    afaRecentHTML = catGras
                        ? `<span style="color: green;"><strong> (+${productsData[0].afa_recent})</strong></span>`
                    : `<span style="color: green;"> (+${productsData[0].afa_recent})</span>`;
                }

                let rfyRecentHTML = '';
                if (
                    typeof productsData[0].total_reco !== 'undefined' &&
                    productsData[0].rfy_recent !== 0 &&
                    productsData[0].rfy_recent !== '0' &&
                    nbReco
                ) {
                    rfyRecentHTML = catGras
                        ? `<span style="color: green;"><strong> (+${productsData[0].rfy_recent})</strong></span>`
                    : `<span style="color: green;"> (+${productsData[0].rfy_recent})</span>`;
                }

                let recoHTML = '';
                if (typeof productsData[0].total_reco !== 'undefined' && nbReco) {
                    recoHTML = `
            <p style="margin:0;">Recommandé pour vous :
                ${productsData[0].total_reco}${rfyRecentHTML}
            </p>`;
                }

                //Contenu final à injecter
                productsDiv.innerHTML = `
        <p style="margin:0; font-weight: bold; text-decoration: underline;">Nouveaux produits</p>
        ${recoHTML}
        <p style="margin:0;">Autres articles : ${productsData[0].ai}${aiRecentHTML}</p>
        <p style="margin:0;">Disponible pour tous : ${productsData[0].afa}${afaRecentHTML}</p>
        <p style="margin:0;">Total jour : ${productsData[0].total}</p>
        <p style="margin:0;">Total mois : ${productsData[0].total_month}</p>
    `;

                //Positionnement du conteneur infoContainer selon contexte
                if (isMobile()) {
                    const showAllDiv = document.querySelector('#categories-sheet-content .vvp-mobile-show-all');
                    if (showAllDiv?.parentNode) {
                        showAllDiv.parentNode.insertBefore(infoContainer, showAllDiv);
                    }
                }
            }

            //Appel API pour commandes du jour
            function qtyOrders() {
                const formData = new URLSearchParams({
                    version: version,
                    token: API_TOKEN,
                });

                return fetch(baseUrlPickme + "/shyrka/qtyorders", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: formData.toString()
                })
                    .then(response => {
                    if (response.status === 401) {
                        return response;
                    }

                    if (!response.ok) {
                        //Erreur HTTP (ex: 404, 500, etc.)
                        console.error("Erreur HTTP:", response.status, response.statusText);
                        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
                    }

                    //Réponse 2xx, on essaie de parser le JSON
                    return response.json().catch(error => {
                        console.error("Erreur lors du parsing JSON:", error);
                        throw error;
                    });
                })
                    .then(ordersData => {
                    //On a réussi à parser le JSON, on appelle qtyOrdersData
                    qtyOrdersData(ordersData);
                    return ordersData;
                })
                    .catch(error => {
                    //Erreur réseau ou de parsing déjà gérée ci-dessus
                    console.error("Erreur de requête:", error);
                    throw error;
                });
            }

            function detectTier() {
                var silverElement = document.getElementById("vvp-silver-tier-label");
                var goldElement = document.getElementById("vvp-gold-tier-label");
                var tier;

                if (silverElement && silverElement.textContent.includes("Argent")) {
                    tier = "silver";
                } else if (goldElement && goldElement.textContent.includes("Or")) {
                    tier = "gold";
                } else {
                    tier = null; //Pas de correspondance trouvée
                }

                return tier;
            }

            //Affichage des données reçu par l'API
            function qtyOrdersData(ordersData) {
                const infoContainer = createInfoContainer();
                //Trouve ou crée le div pour les commandes
                let ordersDiv = document.getElementById('orders-info');
                if (!ordersDiv) {
                    ordersDiv = document.createElement('div');
                    ordersDiv.id = 'orders-info';
                    ordersDiv.style.padding = '0';
                    ordersDiv.style.margin = '0';
                    infoContainer.appendChild(ordersDiv);
                }

                //const ordersMonth = countOrdersThisMonth();
                //const ordersToday = countOrdersToday();

                //Détermine les valeurs à afficher
                //const displayOrdersToday = ordersToday > ordersData.qty_orders_today ? ordersToday : ordersData.qty_orders_today;
                //const displayOrdersMonth = ordersMonth > ordersData.qty_orders_month ? ordersMonth : ordersData.qty_orders_month;
                var tier = detectTier();
                //Détermine le suffixe basé sur le tier
                const suffix = tier === 'gold' ? '/8' : '/3';
                const displayOrdersTodayWithSuffix = `${ordersData.qty_orders_today}${suffix}`;
                //Ajoute les informations au div

                ordersDiv.innerHTML = `
        <p style="margin:0; font-weight: bold; text-decoration: underline;">Mes commandes</p>
        <p style="margin:0;">Aujourd'hui : ${displayOrdersTodayWithSuffix} (${ordersData.sum_price_today} €)</p>
        <p style="margin:0; ${statsEnabled ? 'margin-bottom: 1em;' : ''}">Mois en cours : ${ordersData.qty_orders_month} (${ordersData.sum_price_month} €)</p>
    `;
                //Positionnement du conteneur infoContainer selon contexte
                if (isMobile()) {
                    const showAllDiv = document.querySelector('#categories-sheet-content .vvp-mobile-show-all');
                    if (showAllDiv?.parentNode) {
                        showAllDiv.parentNode.insertBefore(infoContainer, showAllDiv);
                    }
                }
            }

            //Conteneur des stats premium+
            function createInfoContainer() {
                //Trouve le conteneur principal
                const container = document.getElementById('vvp-browse-nodes-container');

                //Crée un conteneur parent pour les informations s'il n'existe pas
                let infoContainer = document.getElementById('info-container');
                if (!infoContainer) {
                    infoContainer = document.createElement('div');
                    infoContainer.id = 'info-container';
                    infoContainer.style.border = '3px solid #ccc';
                    infoContainer.style.padding = '10px';
                    infoContainer.style.marginTop = '10px';
                    infoContainer.style.marginBottom = '10px';
                    infoContainer.style.display = 'none';
                    infoContainer.style.width = 'fit-content';
                    infoContainer.style.whiteSpace = 'nowrap';
                    infoContainer.style.borderRadius = '10px';

                    //Insère le conteneur au bon endroit, sous le bouton "Afficher tout"
                    if (container) {
                        if (mobileEnabled && !isMobile()) {
                            const content = container.querySelector('.vvp-browse-nodes-content');
                            const p = content?.querySelector('p');

                            if (p?.parentNode) {
                                p.parentNode.insertBefore(infoContainer, p.nextSibling);
                            } else if (content) {
                                content.appendChild(infoContainer);
                            } else {
                                container.appendChild(infoContainer);
                            }
                        } else {
                            const referenceNode = container.querySelector('p');
                            if (referenceNode) {
                                container.insertBefore(infoContainer, referenceNode.nextSibling);
                            } else {
                                container.appendChild(infoContainer);
                            }
                        }
                    }
                }

                return infoContainer;
            }

            //Ajout des données reçu par l'API pour synchroniser
            function syncProductsData(productsData, askHide = true, hideAll = false, refresh = true) {
                let userHideAll;
                if (askHide) {
                    userHideAll = confirm("Voulez-vous également cacher tous les produits ? OK pour oui, Annuler pour non.");
                } else {
                    if (hideAll) {
                        userHideAll = true;
                    } else {
                        userHideAll = false;
                    }
                }
                let storedProducts = JSON.parse(GM_getValue("storedProducts", "{}"));
                productsData.forEach(product => {
                    const asin = product.asin;
                    const currentDate = product.date_ajout;
                    const enrollment = product.enrollment;
                    const hideKey = getAsinEnrollment(asin, enrollment);
                    if (userHideAll) {
                        const etatFavoriKey = asin + '_f';
                        const etatFavori = localStorage.getItem(etatFavoriKey) || '0';
                        if (etatFavori === '0') { //Ne modifie l'état de caché que si le produit n'est pas en favori
                            const etatCacheKey = asin + '_c';
                            localStorage.setItem(etatCacheKey, '1');
                        }
                    }
                    //Mettre à jour ou ajouter le produit dans storedProducts
                    if (storedProducts[asin]) {
                        //Si le produit existe déjà, on met uniquement à jour la date
                        storedProducts[asin].dateAdded = currentDate;
                    } else {
                        //Sinon, on ajoute le produit
                        storedProducts[asin] = {
                            added: true, //Marquer le produit comme ajouté
                            enrollmentKey: hideKey, //Key pour la fonction cacher
                            dateAdded: currentDate //Utilisez la date d'ajout fournie par l'API
                        };
                    }
                });

                //Sauvegarder les changements dans storedProducts
                GM_setValue("storedProducts", JSON.stringify(storedProducts));
                if (askHide) {
                    alert("Les produits ont été synchronisés.");
                }
                if (refresh) {
                    window.location.reload();
                }
            }
            //End

            //Determining the queue type from the HTML dom
            function d_queueType(text) {
                switch (text) {
                    case "VENDOR_TARGETED":
                        return "potluck"; //RFY
                    case "VENDOR_VINE_FOR_ALL":
                        return "last_chance"; //AFA
                    case "VINE_FOR_ALL":
                        return "encore"; //AI
                    case "ALL_ITEMS":
                        return "all_items"; //ALL
                    default:
                        return null;
                }
            }

            let parentAsin, parentImage, parentEnrollment, queueType;

            //As much as I hate this, this adds event listeners to all of the "See details" buttons
            document.querySelectorAll('.a-button-primary.'+getStringDetailsBtnSelector()+' > .a-button-inner > input').forEach(function(element) {
                element.addEventListener('click', function() {

                    parentAsin = this.getAttribute('data-asin');
                    parentImage = this.parentElement.parentElement.parentElement.querySelector('img').src.match(PRODUCT_IMAGE_ID)[1];
                    parentEnrollment = getEnrollment(this);
                    queueType = urlData?.[2] || d_queueType(this.getAttribute('data-recommendation-type'));

                    //silencing console errors; a null error is inevitable with this arrangement; I might fix this in the future
                    try {
                        const btn = document.querySelector("button.a-button-discord");
                        btn.style.display = 'none'; //Cache le bouton le temps de charger
                    } catch (error) {
                    }
                });
            });

            window.addEventListener('load', function () {
                var target, observer, config;

                let eltToWatch = 'a#vvp-product-details-modal--product-title';
                //On observe si on ouvre le détail d'un produit
                target = document.querySelector(eltToWatch);
                //Si pas trouvé (par exemple en version mobile)
                if (!target) {
                    eltToWatch = '#product-details-sheet-title';
                    target = document.querySelector(eltToWatch);
                }

                config = {
                    characterData: false,
                    attributes: true,
                    childList: false,
                    subtree: false
                };

                //Mutation observer fires every time the product title in the modal changes
                observer = new MutationObserver(function (mutations) {
                    const prerelease = document.querySelector('#vvp-product-details-modal--product-title.prerelease-title') ||
                          document.querySelector('#product-details-sheet-title.prerelease-title');
                    if (prerelease) {
                        prerelease.style.pointerEvents = 'auto';
                        prerelease.style.cursor = 'pointer';
                        //Force la couleur bleue
                        prerelease.style.setProperty('color', '#2162a1', 'important');
                    }

                    if (!document.querySelector('.a-button-discord')) {
                        addShareButton();
                    }

                    const btn = document.querySelector("button.a-button-discord");
                    if (btn) {
                        btn.style.display = 'inline-flex';
                    }

                    //remove pre-existing event listener before creating a new one
                    document.querySelector("button.a-button-discord")?.removeEventListener("click", buttonHandler);

                    //making sure there aren't any errors in the modal
                    var hasError = !Array.from(errorMessages).every(function(elem) {
                        return elem.style.display === 'none';
                    });
                    var wasPosted = GM_getValue("config")[parentAsin]?.queue;
                    var isModalHidden = (document.querySelector(eltToWatch).style.visibility === 'hidden') ? true : false;

                    if (hasError || queueType == null || queueType == "potluck" || window.location.href.includes('?search')) {
                        //Cacher le bouton si reco, reco ou autres
                        const btn = document.querySelector("button.a-button-discord");
                        if (btn) {
                            btn.style.display = 'none';
                        }
                    } else if (wasPosted === queueType) {
                        //Produit déjà posté
                        updateButtonIcon(4);
                    } else if (!isModalHidden) {
                        updateButtonIcon(0);
                    }
                    if (fastCmdEnabled) {
                        const btn = document.querySelector("button.a-button-discord");
                        if (btn) {
                            btn.addEventListener("click", buttonHandler);
                        }
                        focusButton('input.a-button-input[aria-labelledby="vvp-product-details-modal--request-btn-announce"]', 0);
                        //Mettre le focus sur le bouton "Envoyer à cette adresse"
                        observeShippingModal();
                    }
                });

                try {
                    observer.observe(target, config);
                } catch(error) {
                    console.log('[PïckMe] Aucun produit sur cette page');
                    displayContent();
                }

                function focusButton(selector, timeout = 300) {
                    var button = document.querySelector(selector);
                    if (button && document.activeElement !== button) {
                        //Faire défiler pour s'assurer que le bouton est visible
                        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        //Attendre un court instant avant de mettre le focus
                        setTimeout(function () {
                            //Mettre le focus sur le bouton
                            button.focus();
                            //Forcer le focus si nécessaire
                            if (document.activeElement !== button) {
                                button.setAttribute('tabindex', '-1'); //Rendre le bouton focusable si ce n'est pas déjà le cas
                                button.focus();
                            }
                        }, timeout);
                    }
                }

                function observeShippingModal() {
                    var shippingModalTarget = document.querySelector("#vvp-shipping-address-modal");

                    if (shippingModalTarget) {
                        var shippingObserver = new MutationObserver(function (mutations) {
                            focusButton('input.a-button-input[aria-labelledby="vvp-shipping-address-modal--submit-btn-announce"]');
                        });

                        var shippingConfig = {
                            characterData: false,
                            attributes: true,
                            childList: false,
                            subtree: false
                        };

                        try {
                            shippingObserver.observe(shippingModalTarget, shippingConfig);
                        } catch (error) {
                            console.log('[PïckMe] Erreur lors de l\'observation du modal de l\'adresse d\'expédition');
                        }
                    }
                }

                /*function observeShippingModal() {
                var shippingModalObserver = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        if (mutation.addedNodes.length > 0) {
                            mutation.addedNodes.forEach(function (node) {
                                if (node.nodeType === 1 && node.matches('#vvp-shipping-address-modal--submit-btn')) {
                                    //Focus sur le bouton "Envoyer à cette adresse"
                                    focusButton('input.a-button-input[aria-labelledby="vvp-shipping-address-modal--submit-btn-announce"]');
                                }
                            });
                        }
                    });
                });

                var shippingModalTarget = document.querySelector("#vvp-shipping-address-modal");

                if (shippingModalTarget) {
                    shippingModalObserver.observe(shippingModalTarget, {
                        childList: true,
                        subtree: true
                    });
                } else {
                    console.log('Le modal d\'adresse d\'expédition n\'a pas été trouvé');
                }
            }*/

            });

            //Wheel Fix
            if (apiOk) {
                window.addEventListener("message", (event) => {
                    if (event.data.type === "SET_CHECKOUT_VALUES") {
                        GM_setValue("asinCheckout", event.data.asin);
                        GM_setValue("asinParentCheckout", event.data.parent);
                        GM_setValue("queueCheckout", event.data.queue);
                    }
                });
                if (wheelfixEnabled || ordersEnabled) {
                    const script = document.createElement('script');
                    script.textContent = `
                function showMagicStars() {
                    var style = document.createElement('style');
                    style.innerHTML = \`
            @keyframes sparkle {
                0% { transform: scale(0); opacity: 1; }
                100% { transform: scale(1); opacity: 0; }
            }
            .star {
                position: fixed;
                font-size: 60px; /* Plus grand */
                animation: sparkle 3s forwards; /* Durée plus longue */
                animation-timing-function: ease-out;
                z-index: 999999; /* Très élevé */
            }
            .magic-text {
                position: fixed;
                top: 30%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 40px;
                color: #000099;
           text-shadow:
              -1px -1px 0 #000,
               1px -1px 0 #000,
              -1px  1px 0 #000,
               1px  1px 0 #000; /* Contour noir */
                z-index: 1000000; /* Encore plus élevé */
                animation: fadeInOut 4s forwards; /* Animation pour le texte */
            }
            @keyframes fadeInOut {
                0% { opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { opacity: 0; }
            }
        \`;
                    document.head.appendChild(style);

                    var symbolColorPairs = [
                        { symbol: '★', color: '#FFD700' },
                        { symbol: '❆', color: '#07EEFD' },
                        { symbol: '🐱', color: '#FFD700' },
                        { symbol: '🔥', color: '#FFD700' },
                        { symbol: '🦆', color: '#FFD700' },
                        { symbol: '🐝', color: '#FFD700' },
                        { symbol: '🐧', color: '#FFD700' },
                        { symbol: '🥚', color: '#FFD700' },
                        { symbol: '👰', color: '#FFD700' },
                        { symbol: '🐢', color: '#FFD700' },
                        { symbol: '❤', color: '#FF69B4' }
                    ];

                    //Créer le texte "PickMe Fix"
                    var magicText = document.createElement('div');
                    magicText.className = 'magic-text';
                    magicText.textContent = 'PickMe Fix';
                    document.body.appendChild(magicText);

                    //Supprimer le texte après 3 secondes
                    setTimeout(() => {
                        document.body.removeChild(magicText);
                    }, 3000);
                    let index = Math.floor(Math.random() * symbolColorPairs.length);
                    let pair = symbolColorPairs[index];
                    //Créer et afficher le symbole
                    for (let i = 0; i < 50; i++) {
                        let star = document.createElement('div');
                        star.className = 'star';
                        star.textContent = pair.symbol;
                        star.style.color = pair.color;
                        star.style.top = \`\${Math.random() * window.innerHeight}px\`;
                        star.style.left = \`\${Math.random() * window.innerWidth}px\`;
                        document.body.appendChild(star);

                        //Supprimer l'étoile après l'animation
                        setTimeout(() => {
                            document.body.removeChild(star);
                        }, 3000 + Math.random() * 500);
                    }
                }

                const API_TOKEN = ${JSON.stringify(API_TOKEN)};
                const version = ${JSON.stringify(version)};
                const valeurQueue = ${JSON.stringify(valeurQueue)};
                const ordersEnabled = ${JSON.stringify(ordersEnabled)};
                const wheelfixEnabled = ${JSON.stringify(wheelfixEnabled)};
                const oldCheckoutEnabled = ${JSON.stringify(oldCheckoutEnabled)};
                const checkoutNewTab = ${JSON.stringify(checkoutNewTab)};
                const checkoutEnabled = ${JSON.stringify(checkoutEnabled)};
                const baseUrlPickme = ${JSON.stringify(baseUrlPickme)};
                const origFetch = window.fetch;
                var lastParentVariant = null;
                var responseData = {};
                var postData = {};
                var checkoutAsin = null;
                var checkoutPromotionId = null;
                var checkoutOfferListingId = null;
                window.fetch = async (...args) => {
                    let response = await origFetch(...args);
                    let lastParent = lastParentVariant;
                    let regex = null;

                    const url = args[0] || "";

					if (ordersEnabled) {
						if (url.startsWith("api/voiceOrders")) {
							postData = JSON.parse(args[1].body);
							const asin = postData.itemAsin;

							try {
								responseData = await response.clone().json();
							} catch (e) {
								console.error(e);

							}

							if (lastParent != null) {
								regex = /^.+?#(.+?)#.+$/;
								lastParent = lastParentVariant.recommendationId.match(regex)[1];
							}

							let data = {
								version: version,
								token: API_TOKEN,
								parent_asin: lastParent,
								asin: asin,
								queue: valeurQueue,
							};
							//On test si c'est réussi. Nouveau, offerListingId pas vide a la nouvelle fenetre. Ancien
							if (responseData?.result?.offerListingId !== undefined && checkoutEnabled && !oldCheckoutEnabled) {
								window.postMessage({
  								  type: 'SET_CHECKOUT_VALUES',
  								    asin: asin,
 									parent: lastParent,
								    queue: valeurQueue
								}, '*');
								//data.offerListingId = responseData.result.offerListingId;
							} else {
								if (responseData.error !== null) {
									data.success = "failed";
									data.reason = responseData.error; //CROSS_BORDER_SHIPMENT, SCHEDULED_DELIVERY_REQUIRED, ITEM_NOT_IN_ENROLLMENT, ITEM_ALREADY_ORDERED

									const alertContents = document.querySelectorAll('.a-alert-content');
									const texteAAjouter = "<br><strong>(PickMe) Code erreur : " + responseData.error + "</strong> (<a href='" + baseUrlPickme + "/wiki/doku.php?id=plugins:pickme:codes_erreur' target='_blank'>wiki des codes d'erreurs</a>)";
									alertContents.forEach(function(alertContent) {
										alertContent.innerHTML += texteAAjouter;
									});
								} else if (responseData?.result?.orderId) {
									data.success = "success";
								} else {
									data.success = "failed";
									data.reason = "NO_ORDERID";
								}
								//Envoi des données au serveur
								const formData = new URLSearchParams(data);

								fetch(baseUrlPickme + "/shyrka/order", {
									method: "POST",
									headers: {
										"Content-Type": "application/x-www-form-urlencoded"
									},
									body: formData.toString()
								});

							}

							//Pause de 500 ms pour laisser le serveur traiter la requête
							await new Promise((r) => setTimeout(r, 500));
							return response;
						}
					}

                    regex = new RegExp("^api/recommendations/.*$");
                    if (url.startsWith("api/recommendations")) {
                        try {
                            responseData = await response.clone().json();
                        } catch (e) {
                            console.error(e);
                        }

                        let { result, error } = responseData;

                        if (result === null) {
                            return response;
                        }

						if (checkoutNewTab && checkoutEnabled) {

							//Tentative d'update pendant 3 secondes
							let attempts = 0;
							const maxAttempts = 60; //3 secondes a 50 ms
							const interval = setInterval(() => {
								const checkoutBuyNowForm = document.querySelector("#vvp-checkout-buy-now");
								if (checkoutBuyNowForm) {
									checkoutBuyNowForm.target = "_blank";
									clearInterval(interval);
								} else if (++attempts >= maxAttempts) {
									clearInterval(interval);
								}
							}, 50);
						}

                        if (result.variations !== undefined) {
                            //The item has variations and so is a parent, store it for later interceptions
                            lastParentVariant = result;
                        } else if (result.taxValue !== undefined) {
                            //The item has an ETV value, let's find out if it's a child or a parent
                            const isChild = !!lastParent?.variations?.some((v) => v.asin == result.asin);
                            var asinData = result.asin;
                            //On test si le produit a des variantes, on récupère le parent pour notre base de données
                            if (isChild) {
                                regex = /^.+?#(.+?)#.+$/;
                                let arrMatchesP = lastParent.recommendationId.match(regex);
                                asinData = arrMatchesP[1];
                            }

                            function returnVariations() {
                                var variations = {};

                                document.querySelectorAll('#vvp-product-details-modal--variations-container .vvp-variation-dropdown').forEach(function(elem) {

                                    const type = elem.querySelector('h5').innerText;
                                    const names = Array.from(elem.querySelectorAll('.a-dropdown-container select option')).map(function(option) {
                                        return option.innerText.replace(/[*_~|\`]/g, '\\$&');
                                    });
                                    variations[type] = names;
                                });
                                return variations;
                            }

                            function nbVariations(obj) {
                                let total = 1;
                                for (const key in obj) {
                                    if (Array.isArray(obj[key]) && obj[key].length > 0) {
                                        total *= obj[key].length;
                                    }
                                }
                                return total;
                            }

                            var variations = returnVariations();
                            variations = (Object.keys(variations).length > 0) ? variations : null;

                            var formDataETV = new URLSearchParams({
                                version: version,
                                token: API_TOKEN,
                                asin: asinData,
                                etv: result.taxValue,
                                queue: valeurQueue,
                                limited: result.limitedQuantity,
                                seller: result.byLineContributors[0],
                                variations: JSON.stringify(variations),
                                nb_variations: nbVariations(variations),
                            });
                            if (ordersEnabled) {
                                fetch(baseUrlPickme + "/shyrka/newetv", {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/x-www-form-urlencoded"
                                    },
                                    body: formDataETV.toString()
                                });
                            }
                        }

                        if (oldCheckoutEnabled && result?.asinTangoEligible !== undefined) {
			                responseData.result.asinTangoEligible = false; //Force le checkout d'avant
	                    }

                        if (wheelfixEnabled) {
                            let fixed = 0;
                            //Fix automatique du fix qu'on peut faire à la main
                            /*let timeoutId = setTimeout(function() {
                                var spinner = document.querySelector('.a-spinner.a-spinner-medium');
                                if (spinner) {
                                    let parent = spinner.parentNode;
                                    spinner.remove();

                                    var modalWrapper = document.getElementById('vvp-product-details-modal--spinner');

                                    var container = document.createElement('div');
                                    container.style.textAlign = 'center';
                                    modalWrapper.appendChild(container);

                                    //Créer le texte du titre
                                    var title = document.createElement('p');
                                    title.textContent = 'PickMe Fix';
                                    title.style.fontSize = '24px';
                                    title.style.fontWeight = 'bold';
                                    title.style.marginBottom = '10px';
                                    title.style.textAlign = 'center';
                                    title.style.fontFamily = 'Arial, sans-serif';
                                    container.appendChild(title);

                                    //Créer le texte explicatif sous le titre
                                    var explanationText = document.createElement('p');
                                    explanationText.textContent = "Pour corriger ce produit, il faut choisir la variation souhaitée et cliquer sur le bouton 'Corriger ce produit'. Il suffit ensuite d'ouvrir à nouveau les détails du produit pour le commander.";
                                    explanationText.style.fontSize = '14px';
                                    explanationText.style.marginBottom = '20px';
                                    explanationText.style.textAlign = 'center';
                                    explanationText.style.lineHeight = '1.5';
                                    container.appendChild(explanationText);

                                    //Créer la liste déroulante
                                    var select = document.createElement('select');
                                    select.style.marginBottom = '15px';
                                    container.appendChild(select);

                                    //Parcourir les variations pour les ajouter à la liste
                                    result.variations.forEach(function(variation) {
                                        var option = document.createElement('option');
                                        option.value = variation.asin;
                                        option.textContent = Object.values(variation.dimensions).join(', ');
                                        select.appendChild(option);
                                    });

                                    //Créer le bouton sous la liste
                                    var buttonWrapper = document.createElement('span');
                                    buttonWrapper.className = "a-declarative";
                                    buttonWrapper.setAttribute("data-action", "vvp-hide-modal");
                                    buttonWrapper.setAttribute("data-csa-c-type", "widget");
                                    buttonWrapper.setAttribute("data-csa-c-func-deps", "aui-da-vvp-hide-modal");
                                    buttonWrapper.setAttribute("data-vvp-hide-modal", "{}");

                                    var button = document.createElement('span');
                                    button.className = "a-button a-button-primary";

                                    var buttonInner = document.createElement('span');
                                    buttonInner.className = "a-button-inner";

                                    var buttonInput = document.createElement('input');
                                    buttonInput.className = "a-button-input";
                                    buttonInput.type = "submit";
                                    buttonInput.setAttribute("aria-labelledby", "vvp-product-details-modal--back-btn-announce");

                                    var buttonText = document.createElement('span');
                                    buttonText.className = "a-button-text";
                                    buttonText.id = "vvp-product-details-modal--back-btn-announce";
                                    buttonText.textContent = "Corriger ce produit";

                                    //Assembler le bouton
                                    buttonInner.appendChild(buttonInput);
                                    buttonInner.appendChild(buttonText);
                                    button.appendChild(buttonInner);
                                    buttonWrapper.appendChild(button);

                                    //Ajouter un retour à la ligne pour le bouton
                                    var br = document.createElement('br');
                                    container.appendChild(br);

                                    container.appendChild(buttonWrapper);

                                    //Sélectionner les boutons
                                    const backButton = document.querySelector('#vvp-product-details-modal--back-btn');
                                    const closeButton = document.querySelector('button.a-button-close');

                                    //Fonction qui supprime le contenu de modalWrapper
                                    function clearModalContent() {
                                        //Supprimer tout ce qu'on a ajouté comme texte ou menu déroulant
                                        while (modalWrapper.firstChild) {
                                            modalWrapper.removeChild(modalWrapper.firstChild);
                                        }

                                        //Supprimer les écouteurs pour éviter que cela ne se refasse
                                        backButton.removeEventListener('click', clearModalContent);
                                        closeButton.removeEventListener('click', clearModalContent);
                                        parent.appendChild(spinner);
                                        //Annuler le timer en cours
                                        clearTimeout(timeoutId);
                                    }

                                    //Ajouter un écouteur d'événement sur les deux boutons
                                    backButton.addEventListener('click', clearModalContent);
                                    closeButton.addEventListener('click', clearModalContent);

                                    //Ajouter l'événement de clic au bouton
                                    buttonInput.addEventListener('click', function() {
                                        showMagicStars();
                                        var recommendationId = result.recommendationId;
                                        var selectedAsin = select.value;
                                        var recommendationInputs = document.querySelectorAll('input[data-recommendation-id]');
                                        recommendationInputs.forEach(function(input) {
                                            if (input.getAttribute('data-recommendation-id') === recommendationId) {
                                                input.setAttribute('data-asin', selectedAsin);
                                                input.setAttribute('data-is-parent-asin', 'false');
                                                input.setAttribute('data-recommendation-id', recommendationId);
                                            }
                                        });

                                        //Supprimer tout ce qu'on a ajouté comme texte ou menu déroulant
                                        while (modalWrapper.firstChild) {
                                            modalWrapper.removeChild(modalWrapper.firstChild);
                                        }

                                        //Simuler le clic sur le bouton "Retour" pour fermer le modal
                                        var returnButton = document.querySelector('[data-action="vvp-hide-modal"]');
                                        if (returnButton) {
                                            returnButton.click();
                                        }
                                        parent.appendChild(spinner);
                                    });
                                }
                            }, 3000); //3000 millisecondes = 3 secondes*/

                            result.variations = result.variations?.map((variation) => {
                                if (Object.keys(variation.dimensions || {}).length === 0) {
                                    variation.dimensions = {
                                        asin_no: variation.asin,
                                    };
                                    fixed++;
                                    return variation;
                                }

                                for (const key in variation.dimensions) {
                                    //Sauvegarder la valeur d'origine
                                    let originalValue = variation.dimensions[key]; //

                                    //Échapper les caractères spéciaux
                                    variation.dimensions[key] = variation.dimensions[key]
                                        .replace(new RegExp("&", "g"), "&amp;")
                                        .replace(new RegExp("<", "g"), "&lt;")
                                        .replace(new RegExp(">", "g"), "&gt;")
                                        .replace(new RegExp('"', "g"), "&quot;")
                                        .replace(new RegExp("'", "g"), "&#039;")
                                        .replace(new RegExp("°", "g"), "&#176;")
                                        .replace(new RegExp("/", "g"), " ")
                                        .replace(new RegExp("\\\\(", "g"), "|")
                                        .replace(new RegExp("\\\\)", "g"), "|")
                                        .replace(new RegExp(",", "g"), "");

                                    //Si la valeur a changé, on incrémente fixed
                                    if (originalValue !== variation.dimensions[key]) {
                                        fixed++;
                                    }

                                    if (!variation.dimensions[key].match(/[a-zà-ÿ0-9]$/i)) {
                                        variation.dimensions[key] = variation.dimensions[key];
                                        fixed++;
                                    }

                                    //Ajout d'un espace après ':' ou ')' si nécessaire
                                    variation.dimensions[key] = variation.dimensions[key].replace(/([:)])([^\s])/g, "$1 $2");

                                    //Suppression de l'espace avant un '/'
                                    variation.dimensions[key] = variation.dimensions[key].replace(/(\s[/])/g, "/");
                                }

                                return variation;
                            });

                            if (fixed > 0) {
                                showMagicStars();
                            }

                            return new Response(JSON.stringify(responseData));
                        }
                    }
                    return response;
                };`;
                    document.documentElement.appendChild(script);
                    script.remove();
                }

                function isObjectEmpty(obj) {
                    for (var key in obj) {
                        if (obj.hasOwnProperty(key)) {
                            return false;
                        }
                    }
                    return true;
                }
            }
            //End Wheel Fix

            //Sauvegarder/Restaurer
            //Données RR
            const RRKeys = [
                'RREnabled',
                'enableDateFunction',
                'enableReviewStatusFunction',
                'enableColorFunction',
                'filterEnabled',
                'profilEnabled',
                'pageEnabled',
                'emailEnabled',
                'lastUpdateEnabled',
                'targetPercentageEnabled',
                'autoSaveEnabled',
                'emailTemplates'
            ];

            //Fonction pour récupérer les données de localStorage
            function getLocalStorageData() {
                let data = {};

                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);

                    if (
                        key.endsWith('_c') ||
                        key.endsWith('_f') ||
                        key.startsWith('order_')
                    ) {
                        data[key] = localStorage.getItem(key);
                    }
                }

                RRKeys.forEach(key => {
                    data[key] = localStorage.getItem(key);
                });

                return data;
            }

            //Fonction pour restaurer les données dans localStorage
            function setLocalStorageData(data) {
                for (let key in data) {
                    if (key.endsWith('_c') || key.endsWith('_f')) {
                        localStorage.setItem(key, data[key]);
                    }
                }
            }

            async function saveData() {
                try {
                    //Récupérez toutes les clés sauvegardées
                    const keys = GM_listValues();
                    let data = {};

                    //Exclure les paramètres propres à un appareil
                    const excludedKeys = [
                        'mobileEnabled', 'cssEnabled', 'fastCmdEnabled', 'onMobile',
                        'ordersEnabled', 'ordersStatsEnabled', 'ordersInfos',
                        'lastVisit', 'hideBas', 'autoRefresh', 'purchaseId'
                    ];

                    keys.forEach(key => {
                        if (!excludedKeys.includes(key)) {
                            data[key] = GM_getValue(key);
                        } else {
                            console.log(`[PïckMe] Exclusion de la clé : ${key}`);
                        }
                    });

                    //Ajouter les données de localStorage
                    const localStorageData = getLocalStorageData();
                    data = { ...data, ...localStorageData };

                    //Préparation des données pour l'envoi
                    const formData = {
                        version: version,
                        token: API_TOKEN,
                        settings: data,
                    };

                    //Effectuer la requête fetch
                    const response = await fetch(baseUrlPickme + "/shyrka/save", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(formData)
                    });

                    //Vérifier la réponse
                    if (!response.ok) {
                        throw new Error(`Erreur lors de la sauvegarde : ${response.status} ${response.statusText}`);
                    }

                    const responseData = await response.json();
                    console.log("[PïckMe] Sauvegarde réussie");

                    //Gérer les données de réponse
                    if (responseData.lastSaveDate) {
                        const saveButton = document.getElementById('saveData');
                        saveButton.textContent = `(Premium) Sauvegarder les paramètres/produits (${convertToEuropeanDate(responseData.lastSaveDate)})`;
                        const restoreData = document.getElementById('restoreData');
                        restoreData.removeAttribute('disabled');
                        const restoreDataSelect = document.getElementById('restoreDataSelect');
                        restoreDataSelect.removeAttribute('disabled');
                    } else {
                        console.error("La date de la dernière sauvegarde n'a pas été retournée.");
                    }
                } catch (error) {
                    console.error("Erreur lors de la sauvegarde :", error);
                }
            }

            //Création / injection de l’overlay + barre de progression
            function createProgressUI() {
                const overlay = document.createElement("div");
                overlay.id = "restore-overlay";
                Object.assign(overlay.style, {
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 99999,
                    flexDirection: "column",
                    color: "#fff",
                    fontFamily: "sans-serif"
                });

                const barContainer = document.createElement("div");
                barContainer.style.width = "80%";
                barContainer.style.background = "#333";
                barContainer.style.borderRadius = "4px";
                barContainer.style.overflow = "hidden";
                barContainer.style.marginTop = "10px";

                const bar = document.createElement("div");
                bar.id = "restore-progress-bar";
                bar.style.width = "0%";
                bar.style.height = "20px";
                bar.style.background = "#007bff";

                const text = document.createElement("div");
                text.id = "restore-progress-text";
                text.textContent = "0%";
                text.style.marginTop = "5px";

                barContainer.appendChild(bar);
                overlay.appendChild(document.createTextNode("Restauration en cours..."));
                overlay.appendChild(barContainer);
                overlay.appendChild(text);
                document.body.appendChild(overlay);
            }

            //Mise à jour de la barre
            function updateProgressUI(percent) {
                const bar = document.getElementById("restore-progress-bar");
                const text = document.getElementById("restore-progress-text");
                if (bar && text) {
                    bar.style.width = `${percent}%`;
                    text.textContent = `${Math.floor(percent)}%`;
                }
            }

            //Nettoyage UI + handler
            function removeProgressUI() {
                const overlay = document.getElementById("restore-overlay");
                if (overlay) document.body.removeChild(overlay);
                window.onbeforeunload = null;
            }

            //Intégration dans restoreData
            async function restoreData(type) {
                const needBlockUnload = (type === "all" || type === "settings" || type === "orders");
                if (needBlockUnload) {
                    window.onbeforeunload = (e) => { e.preventDefault(); e.returnValue = ""; };
                }

                const needProgressBar = (type === "all" || type === "settings");
                if (needProgressBar) createProgressUI();

                const update = pct => { if (needProgressBar) updateProgressUI(pct); };

                try {
                    const formData = new URLSearchParams({ version, token: API_TOKEN });
                    const response = await fetch(baseUrlPickme + "/shyrka/restore", {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: formData.toString()
                    });

                    if (!response.ok) throw new Error(`Erreur restauration : ${response.status} ${response.statusText}`);

                    const data = await response.json();
                    const entries = Object.entries(data).filter(([k]) => k !== "storedProducts");

                    const favHideKeys = entries.filter(([k]) => k.endsWith("_c") || k.endsWith("_f"));
                    const settingsKeys = entries.filter(([k]) => !(k.endsWith("_c") || k.endsWith("_f")));
                    const orderKeys = entries.filter(([k]) => k.startsWith("order_"));
                    const hasStoredProd = data.storedProducts !== undefined;

                    const RRSettings = entries.filter(([k]) => RRKeys.includes(k));

                    const doSettings = (type === "all" || type === "settings");
                    const doStoredProd = (type === "all" || type === "products");
                    const doFavHide = (type === "all" || type === "favhide");
                    const doRRSettings = (type === "all" || type === "RRsettings");
                    const doOrders = (type === "all" || type === "orders");

                    let totalOps = 0;
                    if (doStoredProd && hasStoredProd) totalOps += 1;
                    if (doFavHide) totalOps += favHideKeys.length;
                    if (doSettings) totalOps += settingsKeys.length;
                    if (doRRSettings) totalOps += RRSettings.length;
                    if (doOrders) totalOps += orderKeys.length;

                    let done = 0;

                    if (doStoredProd && hasStoredProd) {
                        await GM.setValue("storedProducts", data.storedProducts);
                        update(++done / totalOps * 100);
                    }

                    if (doSettings) {
                        const chunkSize = 100;
                        for (let i = 0; i < settingsKeys.length; i += chunkSize) {
                            const batch = settingsKeys.slice(i, i + chunkSize);
                            await Promise.all(batch.map(([k, v]) => GM.setValue(k, v)));
                            done += batch.length;
                            update(done / totalOps * 100);
                            await new Promise(r => setTimeout(r, 0));
                        }
                    }

                    if (doRRSettings) {
                        const chunkSize = 50;
                        for (let i = 0; i < RRSettings.length; i += chunkSize) {
                            const batch = RRSettings.slice(i, i + chunkSize);
                            for (const [k, v] of batch) {
                                localStorage.setItem(k, v);
                                ++done;
                            }
                            update(done / totalOps * 100);
                            await new Promise(r => setTimeout(r, 0));
                        }
                    }

                    if (doFavHide) {
                        const chunkSize = 500;
                        for (let i = 0; i < favHideKeys.length; i += chunkSize) {
                            const batch = favHideKeys.slice(i, i + chunkSize);
                            for (const [k, v] of batch) {
                                localStorage.setItem(k, v);
                                ++done;
                            }
                            update(done / totalOps * 100);
                            await new Promise(r => setTimeout(r, 0));
                        }
                    }

                    if (doOrders) {
                        const chunkSize = 100;
                        for (let i = 0; i < orderKeys.length; i += chunkSize) {
                            const batch = orderKeys.slice(i, i + chunkSize);
                            for (const [k, v] of batch) {
                                localStorage.setItem(k, v);
                                ++done;
                            }
                            update(done / totalOps * 100);
                            await new Promise(r => setTimeout(r, 0));
                        }
                    }

                } catch (err) {
                    console.error("Erreur lors de la restauration :", err);
                } finally {
                    if (needBlockUnload) window.onbeforeunload = null;
                }
            }

            async function lastSave() {
                try {
                    const formData = new URLSearchParams({
                        version: version,
                        token: API_TOKEN,
                    });

                    const response = await fetch(baseUrlPickme + "/shyrka/lastsave", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: formData.toString()
                    });

                    if (response.status === 200) {
                        const data = await response.json();
                        const europeanDate = convertToEuropeanDate(data.lastSaveDate);
                        return europeanDate;
                    } else if (response.status === 201) {
                        return "Aucune sauvegarde";
                    } else {
                        throw new Error("Erreur lors de la récupération de la dernière sauvegarde");
                    }
                } catch (error) {
                    throw new Error("Erreur lors de la récupération de la dernière sauvegarde : " + error);
                }
            }
            //End sauvegarde

            //Bouton de tri
            function insertSortMenu() {
                //Création du wrapper sans marges verticales, et position à droite
                const wrapper = document.createElement('div');
                wrapper.className = 'tri-container';
                wrapper.style.margin = '0';
                wrapper.style.marginLeft = 'auto';

                //Label "Tri :"
                const label = document.createElement('span');
                label.textContent = 'Tri : ';
                wrapper.appendChild(label);

                //Le <select> et ses options (vide + 4 prédéfinis + Personnalisé)
                const select = document.createElement('select');
                select.className = 'tri-select';
                if (mobileEnabled) {
                    select.style.boxSizing = 'border-box';
                    select.style.maxWidth = '60%';
                    wrapper.style.overflowY = 'hidden';
                }

                //Option vide
                select.appendChild(Object.assign(document.createElement('option'), { value: '', textContent: '' }));

                //Tris prédéfinis
                [
                    { text: 'Prix décroissant', payload: [{ type: 'price', order: 'desc'}] },
                    { text: 'ETV croissant', payload: [{ type: 'etv', order: 'asc'}] },
                    { text: 'Prix croissant', payload: [{ type: 'price', order: 'asc' }] },
                    { text: 'ETV décroissant', payload: [{ type: 'etv', order: 'desc'}] }
                ].forEach(opt => {
                    const o = document.createElement('option');
                    o.textContent = opt.text;
                    o.value = JSON.stringify(opt.payload);
                    select.appendChild(o);
                });

                //Option personnalisé
                const oCustom = document.createElement('option');
                oCustom.value = '__custom__';
                oCustom.textContent = 'Personnalisé';
                select.appendChild(oCustom);

                //Si on a activé déja le tri personnalisé, on présélectionne dans le menu
                if (customSortingEnabled) {
                    oCustom.selected = true;
                    select.remove(0);
                }

                //Événement de changement
                select.addEventListener('change', e => {
                    const v = e.target.value;
                    if (v === '') return;
                    if (v === '__custom__') {
                        sortItems(customSorting);
                    } else {
                        sortItems(JSON.parse(v));
                    }
                    //Ne supprimer l'option vide que si elle existe encore en position 0
                    if (select.options.length > 0 && select.options[0].value === '') {
                        select.remove(0);
                    }
                    //Retire le focus
                    select.blur();
                });

                wrapper.appendChild(select);

                //Insertion seulement si hideEnabled
                if (hideEnabled) {
                    (function waitForContainer() {
                        const container = document.getElementById('divCacherHaut');
                        if (container) {
                            container.style.display = 'flex';
                            container.style.alignItems = 'center';
                            container.appendChild(wrapper);
                        } else {
                            setTimeout(waitForContainer, 50);
                        }
                    })();
                } else {
                    const resultats = document.querySelector('#vvp-items-grid-container > p');
                    if (resultats) {
                        wrapper.style.marginBottom = '10px';
                        resultats.after(wrapper);
                    } else {
                        const vineGrid = document.getElementById('vvp-items-grid');
                        if (vineGrid) {
                            vineGrid.before(wrapper);
                        }
                    }
                }
            }

            if (apiOk && menuSorting) {
                insertSortMenu();
            }

            //Partage de recos

            //Pour savoir si l'utilisateur est sur iOS
            function isIOS() {
                if (forceIos) {
                    return true;
                } else {
                    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
                }
            }

            function insertButton() {
                const button = document.createElement('button');
                button.id = 'share-main-button';
                button.className = 'bouton-action';
                button.textContent = copyShare;
                button.addEventListener('click', handleMainButtonClick);

                //Marge supplémentaire en mobile
                if (isMobile()) {
                    button.style.marginBottom = '5px';
                    if (hideEnabled) {
                        button.style.marginTop = '-10px';
                    } else if (menuSorting) {
                        button.style.marginTop = '5px';
                    }
                } else {
                    button.style.marginLeft = '5px';
                }

                const divCacherHaut = document.querySelector('#divCacherHaut');

                if (isMobile()) {
                    if (hideEnabled && divCacherHaut) {
                        divCacherHaut.insertAdjacentElement('afterend', button);
                    } else {
                        const resultats = document.querySelector('#vvp-items-grid-container > p');
                        const vineGrid = document.querySelector('#vvp-items-grid');

                        if (resultats) {
                            resultats.after(button);
                        } else if (vineGrid) {
                            vineGrid.before(button);
                        }
                    }
                } else {
                    //Desktop
                    const pResultats = document.querySelector('#vvp-items-grid-container > p');
                    if (pResultats) {
                        let inserted = false;
                        pResultats.childNodes.forEach(node => {
                            if (!inserted && node.nodeType === Node.TEXT_NODE && node.textContent.includes("résultats")) {
                                const pos = node.textContent.indexOf("résultats") + "résultats".length;
                                const avant = node.textContent.substring(0, pos);
                                const apres = node.textContent.substring(pos);

                                const textAvant = document.createTextNode(avant);
                                const textApres = document.createTextNode(apres);

                                pResultats.replaceChild(textAvant, node);
                                pResultats.insertBefore(button, textAvant.nextSibling);
                                pResultats.insertBefore(textApres, button.nextSibling);

                                inserted = true;
                            }
                        });
                    }
                }
            }

            //Clic bouton Partager
            function handleMainButtonClick() {
                const newProducts = document.querySelectorAll('.newproduct');
                if (newProducts.length === 0) {
                    doShare(false);
                    return;
                }

                showChoiceButtons();
            }

            //Affiche les boutons "Tout" et "Nouveaux"
            function showChoiceButtons() {
                const mainBtn = document.getElementById('share-main-button');
                if (mainBtn) {
                    mainBtn.style.display = 'none';
                }

                const choiceContainer = document.createElement('div');
                choiceContainer.id = 'choice-container';
                choiceContainer.style.display = 'inline-block';

                //Bouton "Tout"
                const btnTout = document.createElement('button');
                btnTout.textContent = 'Tout';
                btnTout.className = 'bouton-action';
                btnTout.style.marginRight = '5px';
                btnTout.addEventListener('click', handleToutClick);

                //Bouton "Nouveaux"
                const btnNouveaux = document.createElement('button');
                btnNouveaux.textContent = 'Nouveaux';
                btnNouveaux.className = 'bouton-action';
                btnNouveaux.addEventListener('click', handleNouveauxClick);

                //Marge supplémentaire en mobile
                if (isMobile()) {
                    btnTout.style.marginBottom = '5px';
                    btnNouveaux.style.marginBottom = '5px';
                    if (hideEnabled) {
                        btnTout.style.marginTop = '-10px';
                        btnNouveaux.style.marginTop = '-10px';
                    } else if (menuSorting) {
                        btnTout.style.marginTop = '5px';
                        btnNouveaux.style.marginTop = '5px';
                    }
                } else {
                    btnTout.style.marginLeft = '5px';
                    btnNouveaux.style.marginLeft = '5px';
                }

                choiceContainer.appendChild(btnTout);
                choiceContainer.appendChild(btnNouveaux);

                const divCacherHaut = document.querySelector('#divCacherHaut');

                if (isMobile()) {
                    if (hideEnabled && divCacherHaut) {
                        divCacherHaut.insertAdjacentElement('afterend', choiceContainer)
                    } else {
                        const resultats = document.querySelector('#vvp-items-grid-container > p');
                        const vineGrid = document.querySelector('#vvp-items-grid');

                        if (resultats) {
                            resultats.after(choiceContainer);
                        } else if (vineGrid) {
                            vineGrid.before(choiceContainer);
                        }
                    }
                } else {
                    //Desktop
                    const pResultats = document.querySelector('#vvp-items-grid-container > p');
                    if (pResultats) {
                        let inserted = false;
                        pResultats.childNodes.forEach(node => {
                            if (!inserted && node.nodeType === Node.TEXT_NODE && node.textContent.includes("résultats")) {
                                const pos = node.textContent.indexOf("résultats") + "résultats".length;
                                const avant = node.textContent.substring(0, pos);
                                const apres = node.textContent.substring(pos);

                                const textAvant = document.createTextNode(avant);
                                const textApres = document.createTextNode(apres);

                                pResultats.replaceChild(textAvant, node);
                                pResultats.insertBefore(choiceContainer, textAvant.nextSibling);
                                pResultats.insertBefore(textApres, choiceContainer.nextSibling);

                                inserted = true;
                            }
                        });
                    }
                }
            }

            //Gestion du clic "Tout"
            function handleToutClick() {
                removeChoiceButtons();
                doShare(false);
            }

            //Gestion du clic "Nouveaux"
            function handleNouveauxClick() {
                removeChoiceButtons();
                doShare(true);
            }

            //Supprime les deux boutons de choix et ré-affiche le bouton principal
            function removeChoiceButtons() {
                const choiceContainer = document.getElementById('choice-container');
                if (choiceContainer) {
                    choiceContainer.remove();
                }
                const mainBtn = document.getElementById('share-main-button');
                if (mainBtn) {
                    mainBtn.style.display = 'inline-block';
                }
            }

            function getAllImages(onlyNew = false) {
                let produits = document.querySelectorAll('.vvp-item-tile');
                const newProducts = document.querySelectorAll('.newproduct');

                if (onlyNew && newProducts.length > 0) {
                    produits = newProducts;
                }

                const images = [];
                produits.forEach((produit) => {
                    const imageEl = produit.querySelector('.vvp-item-tile-content img');
                    const nameEl = produit.querySelector('.a-truncate-full.a-offscreen');
                    const asinInput = produit.querySelector('.'+getStringDetailsBtnSelector()+' input');
                    if (imageEl && asinInput) {
                        const name = nameEl ? nameEl.textContent.trim() : '';
                        const asin = asinInput.getAttribute('data-asin');
                        if (shareOnlyShow) {
                            const parentDiv = produit.closest('.vvp-item-tile');
                            const enrollment = getEnrollment(parentDiv);
                            const hideKey = getAsinEnrollment(asin, enrollment);
                            const etatCacheKey = hideKey + '_c';
                            if (localStorage.getItem(etatCacheKey) === '1') {
                                return;
                            }
                        }
                        const productUrl = 'https://www.amazon.fr/dp/' + asin;
                        images.push({
                            src: imageEl.src,
                            name: name,
                            url: productUrl
                        });
                    }
                });
                return images;
            }

            function doShare(onlyNew) {
                const produits = getAllImages(onlyNew);

                if (produits.length === 0) {
                    alert("Aucun produit trouvé sur la page");
                    return;
                }

                const formData = {
                    version: version,
                    token: API_TOKEN,
                    urls: produits,
                    new: onlyNew,
                };

                fetch(baseUrlPickme + '/shyrka/sharereco', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                })
                    .then(response => {
                    if (response.status === 201) {
                        return response.text().then(message => {
                            alert(message);
                            throw new Error("Token invalide");
                        });
                    } else if (!response.ok) {
                        throw new Error("Erreur API: " + response.status);
                    }
                    return response.json();
                })
                    .then(data => {
                    if (data.url) {
                        let pasteText = onlyNew
                        ? '[Recommandations Horaire/Nouvelles](' + data.url + ")\n" + data.text
                        : '[Recommandations](' + data.url + ")\n" + data.text;

                        if (shareOnlyProduct) {
                            pasteText = data.url;
                        }

                        if (isIOS()) {
                            //Stocker le texte globalement + afficher bouton
                            lastGeneratedShareText = pasteText;
                            showCopyButton();
                        } else {
                            navigator.clipboard.writeText(pasteText)
                                .then(() => {
                                alert("Les produits sont copiés dans le presse-papiers, il ne reste plus qu'à coller sur discord");
                            })
                                .catch(err => {
                                console.error("Erreur lors de la copie dans le presse-papiers", err);
                                alert("Erreur lors de la copie dans le presse-papiers");
                            });
                        }
                    } else {
                        alert("Erreur: réponse invalide de l'API");
                    }
                })
                    .catch(err => {
                    console.error("Erreur API", err);
                    alert("Erreur lors de l'appel à l'API");
                });
            }

            //Bouton "Copier" pour iOS uniquement
            let lastGeneratedShareText = null;

            function showCopyButton() {
                //Supprimer un bouton précédent s'il existe déjà
                const mainBtn = document.getElementById('share-main-button');
                if (mainBtn) {
                    mainBtn.style.display = 'none';
                }

                const mainBtnChoice = document.getElementById('choice-container');
                if (mainBtnChoice) {
                    mainBtnChoice.style.display = 'none';
                }

                const mainBtnCopy = document.getElementById('ios-copy-btn');
                if (mainBtnCopy) {
                    mainBtnCopy.style.display = 'none';
                }

                const copyBtn = document.createElement('button');
                copyBtn.id = 'ios-copy-btn';
                copyBtn.className = 'bouton-action';
                copyBtn.textContent = 'Copier';

                if (isMobile()) {
                    copyBtn.style.marginBottom = '5px';
                    if (hideEnabled) {
                        copyBtn.style.marginTop = '-10px';
                    } else if (menuSorting) {
                        copyBtn.style.marginTop = '5px';
                    }
                } else {
                    copyBtn.style.marginLeft = '5px';
                }

                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(lastGeneratedShareText)
                        .then(() => {
                        alert("Les produits sont copiés dans le presse-papiers, il ne reste plus qu'à coller sur discord");
                    })
                        .catch(err => {
                        console.error("Erreur clipboard", err);
                    });
                });

                //Placement du bouton dans l'interface
                const divCacherHaut = document.querySelector('#divCacherHaut');

                if (isMobile()) {
                    if (hideEnabled && divCacherHaut) {
                        divCacherHaut.insertAdjacentElement('afterend', copyBtn);
                    } else {
                        const resultats = document.querySelector('#vvp-items-grid-container > p');
                        const vineGrid = document.querySelector('#vvp-items-grid');

                        if (resultats) {
                            resultats.after(copyBtn);
                        } else if (vineGrid) {
                            vineGrid.before(copyBtn);
                        }
                    }
                } else {
                    const pResultats = document.querySelector('#vvp-items-grid-container > p');
                    if (pResultats) {
                        let inserted = false;
                        pResultats.childNodes.forEach(node => {
                            if (!inserted && node.nodeType === Node.TEXT_NODE && node.textContent.includes("résultats")) {
                                const pos = node.textContent.indexOf("résultats") + "résultats".length;
                                const avant = node.textContent.substring(0, pos);
                                const apres = node.textContent.substring(pos);

                                const textAvant = document.createTextNode(avant);
                                const textApres = document.createTextNode(apres);

                                pResultats.replaceChild(textAvant, node);
                                pResultats.insertBefore(copyBtn, textAvant.nextSibling);
                                pResultats.insertBefore(textApres, copyBtn.nextSibling);

                                inserted = true;
                            }
                        });
                    }
                }
            }


            if (shareReco && apiOk && valeurQueue == "potluck") {
                insertButton();
                if (!hideEnabled) {
                    //Ajout du style pour les boutons
                    const style = document.createElement('style');

                    style.textContent = `
		 .bouton-action {
			background-color: #f7ca00;
			color: black;
			font-weight: bold;
			text-decoration: none;
			display: inline-block;
			border: 1px solid #dcdcdc;
			border-radius: 20px;
			padding: 5px 15px;
			margin-right: 5px;
			cursor: pointer;
			outline: none;
		}
		`;
                    document.head.appendChild(style);
                }
            }

            //AutoRefresh
            function reloadAtNextFullHour() {
                let refreshInterval;
                let countdownDiv;

                //Nouvelles variables pour la plage horaire
                let autoRefreshTimeSlot = GM_getValue("autoRefreshTimeSlot", true);
                let timeSlotStart = GM_getValue("timeSlotStart", "02:00");
                let timeSlotEnd = GM_getValue("timeSlotEnd", "14:00");

                //Fonction pour générer un entier aléatoire
                function getRandomInteger(min, max) {
                    min = Math.ceil(min);
                    max = Math.floor(max);
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }

                //Calcul du prochain délai de refresh
                function calculateRefreshDelay() {
                    //Détermination si on est dans la plage horaire
                    let now = new Date();
                    let inSlot = true;
                    if (autoRefreshTimeSlot) {
                        const [startH, startM] = timeSlotStart.split(':').map(Number);
                        const [endH, endM] = timeSlotEnd.split(':').map(Number);
                        const nowMinutes = now.getHours() * 60 + now.getMinutes();
                        const startMinutes = startH * 60 + startM;
                        const endMinutes = endH * 60 + endM;
                        if (startMinutes <= endMinutes) {
                            inSlot = (nowMinutes >= startMinutes && nowMinutes <= endMinutes);
                        } else {
                            //Plage qui passe par minuit
                            inSlot = (nowMinutes >= startMinutes || nowMinutes <= endMinutes);
                        }
                    }

                    //Autorise le refresh dynamique seulement si on est dans la plage (ou si autoRefreshTimeSlot désactivé)
                    const allowDynamic = (!autoRefreshTimeSlot || inSlot) && enableRefresh;
                    //Si ni dynamique ni horaire fixé, on ne schedule rien
                    if (!allowDynamic && !useFixedHour) return;

                    //Calcul du délai dynamique
                    const randomSec = getRandomInteger(0, randomDelay);
                    const totalDelaySec = (refreshDelay * 60) + randomSec;
                    let nextRefreshTime = Date.now() + (totalDelaySec * 1000);
                    let useHoraire = false;

                    //Calcul du prochain rafraîchissement horaire
                    const nowDate = new Date();
                    const nextHour = new Date(nowDate);
                    nextHour.setMinutes(0, 0, 0);
                    nextHour.setHours(nowDate.getHours() + 1);
                    const candidateFixed = nextHour.getTime() + (randomSec * 1000);

                    if (useFixedHour) {
                        if (allowDynamic) {
                            //choix entre dynamique et horaire
                            if (candidateFixed < nextRefreshTime) {
                                nextRefreshTime = candidateFixed;
                                useHoraire = true;
                            }
                        } else {
                            //en dehors de la plage dynamiques, mais horaire activé
                            nextRefreshTime = candidateFixed;
                            useHoraire = true;
                        }
                    }

                    return { nextRefreshTime, useHoraire };
                }

                //Ajout de l'UI pour activer le refresh, choisir page, délais, etc.
                function addAutoRefreshUI() {
                    const container = document.createElement('div');
                    container.classList.add('refresh');
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.position = 'relative';
                    container.style.top = '0px';
                    container.style.left = '20px';

                    const optionsContainer = document.createElement('div');
                    optionsContainer.classList.add('options-refresh');
                    optionsContainer.style.marginLeft = '10px';
                    optionsContainer.style.backgroundColor = '#f9f9f9';
                    optionsContainer.style.border = '1px solid #ddd';
                    optionsContainer.style.borderRadius = '8px';
                    optionsContainer.style.padding = '10px';
                    optionsContainer.style.display = 'flex';
                    optionsContainer.style.flexDirection = 'row';
                    optionsContainer.style.alignItems = 'center';
                    optionsContainer.style.width = 'auto';
                    optionsContainer.style.maxWidth = '800px';

                    //Checkbox Activer
                    const enableRefreshLabel = document.createElement('label');
                    const enableRefreshCheckbox = document.createElement('input');
                    enableRefreshCheckbox.type = 'checkbox';
                    enableRefreshCheckbox.style.marginRight = '5px';
                    enableRefreshLabel.appendChild(enableRefreshCheckbox);
                    enableRefreshLabel.appendChild(document.createTextNode('Activer'));
                    enableRefreshLabel.style.alignItems = 'center';
                    enableRefreshLabel.style.gap = '5px';
                    enableRefreshLabel.style.marginRight = '20px';
                    optionsContainer.appendChild(enableRefreshLabel);

                    enableRefreshCheckbox.addEventListener('click', function() {
                        enableRefresh = enableRefreshCheckbox.checked;
                        GM_setValue('enableRefresh', enableRefresh);
                        scheduleRefresh();
                    });

                    //Sélection de la page
                    const pageContainer = document.createElement('div');
                    pageContainer.style.display = 'flex';
                    pageContainer.style.flexDirection = 'column';
                    pageContainer.style.marginRight = '15px';
                    pageContainer.style.alignItems = 'center';

                    const pageLabel = document.createElement('label');
                    pageLabel.innerText = 'Page';
                    pageLabel.style.marginBottom = '4px';
                    pageLabel.style.textAlign = 'center';
                    pageContainer.appendChild(pageLabel);

                    const pageSelect = document.createElement('select');
                    const pages = [
                        { label: 'Page actuelle', value: 'current' },
                        { label: 'Recommandé pour vous', value: 'potluck' },
                        { label: 'Disponible pour tous', value: 'last_chance' },
                        { label: 'Autres articles', value: 'encore' },
                        { label: 'Tous les articles', value: 'all_items' },
                    ];
                    pages.forEach(page => {
                        const option = document.createElement('option');
                        option.value = page.value;
                        option.innerText = page.label;
                        pageSelect.appendChild(option);
                    });
                    pageSelect.style.marginBottom = '5px';
                    pageContainer.appendChild(pageSelect);
                    optionsContainer.appendChild(pageContainer);

                    pageSelect.addEventListener('change', function() {
                        GM_setValue('pageToRefresh', pageSelect.value);
                        pageToRefresh = pageSelect.value;
                    });

                    //Délai (min)
                    const delayContainer = document.createElement('div');
                    delayContainer.style.marginRight = '0px';
                    delayContainer.style.display = 'flex';
                    delayContainer.style.flexDirection = 'column';
                    delayContainer.style.alignItems = 'center';

                    const delayLabel = document.createElement('label');
                    delayLabel.innerText = 'Délai (min)';
                    delayLabel.style.display = 'block';
                    delayContainer.appendChild(delayLabel);

                    const delayInput = document.createElement('input');
                    delayInput.type = 'number';
                    delayInput.style.width = '50px';
                    delayInput.style.textAlign = 'center';
                    delayContainer.appendChild(delayInput);
                    optionsContainer.appendChild(delayContainer);

                    delayInput.addEventListener('change', function() {
                        if (!delayInput.value || delayInput.value === "0") delayInput.value = 5;
                        GM_setValue('refreshDelay', delayInput.value);
                        refreshDelay = Number(delayInput.value);
                        scheduleRefresh();
                    });

                    const plusText = document.createElement('span');
                    plusText.innerText = '+';
                    plusText.style.margin = 'auto 15px';
                    plusText.style.fontSize = '16px';
                    plusText.style.display = 'flex';
                    plusText.style.alignItems = 'center';
                    optionsContainer.appendChild(plusText);

                    //Aléatoire max (sec)
                    const randomDelayContainer = document.createElement('div');
                    randomDelayContainer.style.marginRight = '15px';
                    randomDelayContainer.style.display = 'flex';
                    randomDelayContainer.style.flexDirection = 'column';
                    randomDelayContainer.style.alignItems = 'center';

                    const randomDelayLabel = document.createElement('label');
                    randomDelayLabel.innerText = 'Aléatoire max (sec)';
                    randomDelayLabel.style.display = 'block';
                    randomDelayContainer.appendChild(randomDelayLabel);

                    const randomDelayInput = document.createElement('input');
                    randomDelayInput.type = 'number';
                    randomDelayInput.style.width = '50px';
                    randomDelayInput.style.textAlign = 'center';
                    randomDelayContainer.appendChild(randomDelayInput);
                    optionsContainer.appendChild(randomDelayContainer);

                    randomDelayInput.addEventListener('change', function() {
                        if (!randomDelayInput.value) randomDelayInput.value = 15;
                        GM_setValue('randomDelay', randomDelayInput.value);
                        randomDelay = Number(randomDelayInput.value);
                        scheduleRefresh();
                    });

                    //Checkbox Horaire
                    const fixedHourLabel = document.createElement('label');
                    const fixedHourCheckbox = document.createElement('input');
                    fixedHourCheckbox.type = 'checkbox';
                    fixedHourCheckbox.style.marginRight = '5px';
                    fixedHourLabel.appendChild(fixedHourCheckbox);
                    fixedHourLabel.appendChild(document.createTextNode('Horaire'));
                    fixedHourLabel.classList.add('fixed-hour-label');
                    fixedHourLabel.style.borderLeft = '1px solid #0f1111';
                    fixedHourLabel.style.paddingLeft = '10px';
                    fixedHourLabel.style.marginLeft = '10px';
                    fixedHourLabel.style.alignItems = 'center';
                    optionsContainer.appendChild(fixedHourLabel);

                    fixedHourCheckbox.addEventListener('click', function() {
                        useFixedHour = fixedHourCheckbox.checked;
                        GM_setValue('useFixedHour', useFixedHour);
                        scheduleRefresh();
                    });

                    const logoLink = document.querySelector('#vvp-logo-link');
                    const headerLinksContainer = document.querySelector('.vvp-header-links-container');
                    logoLink.parentNode.insertBefore(optionsContainer, headerLinksContainer);

                    //Appliquer les valeurs stockées
                    pageSelect.value = pageToRefresh;
                    delayInput.value = refreshDelay;
                    randomDelayInput.value = randomDelay;
                    fixedHourCheckbox.checked = useFixedHour;
                    enableRefreshCheckbox.checked = enableRefresh;
                }

                //Schedule le refresh et affiche le compte à rebours
                function scheduleRefresh() {
                    if (refreshInterval) {
                        clearInterval(refreshInterval);
                        refreshInterval = null;
                    }
                    if (countdownDiv) {
                        countdownDiv.remove();
                        countdownDiv = null;
                    }
                    const next = calculateRefreshDelay();
                    if (!next) return;

                    const now = Date.now();
                    const delay = next.nextRefreshTime - now;

                    countdownDiv = document.createElement('div');
                    countdownDiv.style.position = refreshFixed ? 'absolute' : 'fixed';
                    countdownDiv.style.top = headerEnabled ? refreshVerticalNoHeader : refreshVertical;
                    countdownDiv.style.left = refreshHorizontal;
                    countdownDiv.style.transform = 'translateX(-50%)';
                    countdownDiv.style.backgroundColor = '#191919';
                    countdownDiv.style.color = '#fff';
                    countdownDiv.style.padding = '5px';
                    countdownDiv.style.borderRadius = '5px';
                    countdownDiv.style.zIndex = '9999';
                    countdownDiv.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                    document.body.appendChild(countdownDiv);

                    function updateCountdown() {
                        const timeLeft = next.nextRefreshTime - Date.now();
                        if (timeLeft <= 0) {
                            countdownDiv.textContent = 'Actualisation...';
                            let targetUrl = 'https://www.amazon.fr/vine/vine-items?queue=';
                            if (pageToRefresh === 'current') {
                                targetUrl = window.location.href;
                            } else if (pageToRefresh === 'potluck') {
                                targetUrl += 'potluck';
                            } else if (pageToRefresh === 'last_chance') {
                                targetUrl += 'last-chance';
                            } else if (pageToRefresh === 'encore') {
                                targetUrl += 'encore';
                            } else if (pageToRefresh === 'all_items') {
                                targetUrl += 'all_items';
                            }
                            window.location.href = targetUrl;
                        } else {
                            const minutes = Math.floor(timeLeft / 1000 / 60);
                            const seconds = Math.floor((timeLeft / 1000) % 60);
                            countdownDiv.textContent = '';
                            if (next.useHoraire) {
                                countdownDiv.textContent += '(Horaire) ';
                            }
                            countdownDiv.textContent += `Prochaine actualisation : ${minutes} min. ${seconds} sec.`;
                        }
                    }

                    refreshInterval = setInterval(updateCountdown, 1000);
                    updateCountdown();
                }

                const nextRefreshTime = calculateRefreshDelay();
                if (!(useFixedHour && refreshHideUI) && !isMobile()) {
                    addAutoRefreshUI();
                }
                scheduleRefresh();
            }

            //Pour trier les produits selon un ordre défini => type ['firstproduct', 'newproduct','favproduct', 'putproduct', 'price','etv'] / order ['asc','desc'] (uniquement pour price et etv)
            function sortItems(criteria = []) {
                const container = document.getElementById('vvp-items-grid');
                if (!container || criteria.length === 0) return;

                //Récupère tous les éléments dans le container
                const items = Array.from(container.children);

                //Types traités comme booléens (1 si la classe est présente, 0 sinon)
                const booleanTypes = ['newproduct', 'favproduct', 'putproduct', 'firstproduct'];

                function getValue(item, type) {
                    if (booleanTypes.includes(type)) {
                        return item.classList.contains(type) ? 1 : 0;
                    }
                    //Pour price et etv : on lit les data-attributes et on parse en nombre
                    const orderDiv = item.querySelector('.order-item');
                    if (!orderDiv) return Infinity;
                    const raw = (type === 'price')
                    ? orderDiv.dataset.price
                    : orderDiv.dataset.etv;
                    const num = parseFloat(raw);
                    return isNaN(num) ? Infinity : num;
                }

                items.sort((a, b) => {
                    for (const { type, order = 'desc' } of criteria) {
                        const va = getValue(a, type);
                        const vb = getValue(b, type);

                        //Tri booléen pour newproduct / favproduct / putproduct (toujours desc)
                        if (booleanTypes.includes(type) && va !== vb) {
                            return vb - va;
                        }

                        //Tri numérique pour price / etv
                        if ((type === 'price' || type === 'etv') && va !== vb) {
                            return (order === 'asc') ? va - vb : vb - va;
                        }
                    }
                    return 0;
                });

                //On réinsère les éléments dans l'ordre trié
                items.forEach(item => container.appendChild(item));
            }

            //Appeler la fonction immédiatement au chargement de la page
            if (autoRefresh) {
                reloadAtNextFullHour();
            }

            //Seulement si c'est une page de produit, sinon on retire de suite
            if (window.location.href.includes("queue=")) {
                if (autohideEnabled) {
                    const intervalId = setInterval(() => {
                        if (allFinish) {
                            clearInterval(intervalId);
                            if (customSortingEnabled) {
                                sortItems(customSorting);
                            }
                            displayContent();
                        }
                    }, 50);
                    //setTimeout(displayContent, 600);
                } else {
                    if (ordersInfos && ordersEnabled) {
                        const intervalId = setInterval(() => {
                            if (allFinish) {
                                clearInterval(intervalId);
                                if (customSortingEnabled) {
                                    sortItems(customSorting);
                                }
                                displayContent();
                            }
                        }, 50);
                    } else {
                        if (customSortingEnabled) {
                            sortItems(customSorting);
                        }
                        displayContent();
                    }
                }
            } else {
                displayContent();
            }

            //Ronde
            if (apiOk && rondeEnabled && (window.location.href.includes("queue=encore") || window.location.href.includes("queue=all_items"))) {
                let timerId = null;
                let countdownIntervalId = null;
                let currentDelay = 0;
                let countdownStartTimestamp = 0;

                let isPaused = GM_getValue('rondeIsPaused', false);
                let remainingDelay = GM_getValue('rondeRemainingDelay', 0);

                let rondeContinue = GM_getValue('rondeContinue', false);

                let startTimeStr = GM_getValue('rondeStartTime', null);
                let startTime = startTimeStr ? new Date(startTimeStr) : null;

                let pageCount = GM_getValue('rondePageCount', 0);

                const playIcon = rondePlayUrl;
                const stopIcon = rondeStopUrl;
                const pauseIconUrl = rondePauseUrl;

                const overlay = document.createElement('div');
                overlay.id = 'rondeOverlay';
                overlay.style.position = rondeFixed ? 'absolute' : 'fixed';
                overlay.style.top = headerEnabled ? rondeVerticalHeader : rondeVertical;
                overlay.style.left = rondeHorizontal;
                overlay.style.transform = 'translateX(-50%)';
                overlay.style.backgroundColor = '#fff';
                overlay.style.border = '2px solid rgba(51,51,51,0.7)';
                overlay.style.padding = '5px 5px';
                overlay.style.borderRadius = '8px';
                overlay.style.boxShadow = '0 4px 8px rgba(100,100,100,0.2)';
                overlay.style.zIndex = '9999';
                overlay.style.fontFamily = 'Arial, sans-serif';
                overlay.style.fontSize = '14px';

                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.gap = '5px';

                const pauseButton = document.createElement('button');
                pauseButton.style.padding = '0';
                pauseButton.style.cursor = 'pointer';
                pauseButton.style.border = 'none';
                pauseButton.style.borderRadius = '4px';
                pauseButton.style.backgroundColor = '#fff';
                pauseButton.style.display = 'none';
                pauseButton.style.alignItems = 'center';
                pauseButton.style.justifyContent = 'center';
                pauseButton.style.width = '40px';
                pauseButton.style.height = '40px';
                //Si la ronde était en pause, on affiche l'icône "resume", sinon l'icône "pause"
                pauseButton.innerHTML = isPaused
                    ? `<img src="${playIcon}" alt="Resume" style="height:32px; width:auto;">`
                : `<img src="${pauseIconUrl}" alt="Pause" style="height:32px; width:auto;">`;
                pauseButton.addEventListener('mouseover', () => {
                    pauseButton.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
                });
                pauseButton.addEventListener('mouseout', () => {
                    pauseButton.style.boxShadow = 'none';
                });
                container.appendChild(pauseButton);

                const startStopButton = document.createElement('button');
                startStopButton.style.padding = '0';
                startStopButton.style.cursor = 'pointer';
                startStopButton.style.border = 'none';
                startStopButton.style.borderRadius = '4px';
                startStopButton.style.backgroundColor = '#fff';
                startStopButton.style.display = 'flex';
                startStopButton.style.alignItems = 'center';
                startStopButton.style.justifyContent = 'center';
                startStopButton.style.width = '40px';
                startStopButton.style.height = '40px';

                startStopButton.innerHTML = `<img src="${playIcon}" alt="Play" style="height:32px; width:auto;">`;
                startStopButton.addEventListener('mouseover', () => {
                    startStopButton.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
                });
                startStopButton.addEventListener('mouseout', () => {
                    startStopButton.style.boxShadow = 'none';
                });
                container.appendChild(startStopButton);

                //Timer
                const timerDisplay = document.createElement('div');
                timerDisplay.id = 'rondeTimer';
                timerDisplay.style.position = 'absolute';
                timerDisplay.style.top = '110%';
                timerDisplay.style.left = '50%';
                timerDisplay.style.transform = 'translateX(-50%)';
                timerDisplay.style.marginTop = '1px';
                timerDisplay.style.fontSize = '12px';
                timerDisplay.style.color = '#fff';
                timerDisplay.style.backgroundColor = '#191919';
                timerDisplay.style.padding = '1px 4px';
                timerDisplay.style.borderRadius = '4px';
                timerDisplay.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                timerDisplay.style.display = 'inline-block';
                timerDisplay.style.whiteSpace = 'nowrap';
                timerDisplay.style.width = 'auto';
                timerDisplay.style.display = 'none';
                container.appendChild(timerDisplay);

                overlay.appendChild(container);
                document.body.appendChild(overlay);

                //Si rondeHide est activé, simuler un clic sur le bouton "Tout cacher"
                if (hideEnabled && rondeHide && rondeContinue) {
                    simulerClicSurBouton('boutonCacherToutHaut');
                }

                //Réinitialisation pour une nouvelle ronde et mise à jour de l'interface
                function resetRound() {
                    GM_setValue('rondeStartTime', null);
                    GM_setValue('rondePageCount', 0);
                    GM_setValue('rondeIsPaused', false);
                    GM_setValue('rondeRemainingDelay', 0);
                    startStopButton.innerHTML = `<img src="${playIcon}" alt="Play" style="height:32px; width:auto;">`;
                    pauseButton.style.display = 'none';
                    timerDisplay.style.display = 'none';
                    isPaused = false;
                }

                //Résumé de la ronde
                function finalizeRound(isVoluntary) {
                    function timeToSeconds(date) {
                        return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
                    }

                    const finishTime = new Date();
                    const storedStartTimeStr = GM_getValue('rondeStartTime', null);
                    const storedStartTime = storedStartTimeStr ? new Date(storedStartTimeStr) : finishTime;

                    //Calcul en secondes en soustrayant les secondes totales
                    let elapsedSeconds = timeToSeconds(finishTime) - timeToSeconds(storedStartTime);

                    //Si la ronde traverse minuit
                    if (elapsedSeconds < 0) {
                        elapsedSeconds += 24 * 3600;
                    }

                    const hours = Math.floor(elapsedSeconds / 3600);
                    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
                    const seconds = elapsedSeconds % 60;

                    const pad = (num) => String(num).padStart(2, '0');
                    const elapsedFormatted = `${hours}h ${minutes}m ${seconds}s`;
                    const startFormatted = `${pad(storedStartTime.getHours())}:${pad(storedStartTime.getMinutes())}:${pad(storedStartTime.getSeconds())}`;
                    const finishFormatted = `${pad(finishTime.getHours())}:${pad(finishTime.getMinutes())}:${pad(finishTime.getSeconds())}`;

                    const getMessage = title =>
                    `${title} !\nTemps écoulé : ${elapsedFormatted}\nLancement : ${startFormatted}\nFin : ${finishFormatted}\nPages parcourues : ${pageCount}`;

                    const baseTitle = isVoluntary ? 'Ronde stoppée' : 'Ronde effectuée';

                    const message = getMessage(baseTitle);
                    const messageToCopy = getMessage(`**${baseTitle}**`);

                    navigator.clipboard.writeText(messageToCopy)
                        .then(() => console.log('[PïckMe] Résumé de la ronde copié dans le presse-papiers.'))
                        .catch(err => console.error('Erreur lors de la copie dans le presse-papiers:', err));

                    alert("Copié dans le presse-papiers :\n\n" + message);

                    resetRound();
                }

                //Fonction de démarrage du compte à rebours
                function startCountdown(seconds) {
                    currentDelay = seconds;
                    remainingDelay = seconds;
                    countdownStartTimestamp = Date.now();
                    timerDisplay.textContent = `Ronde en cours : ${remainingDelay} sec.`;
                    if (countdownIntervalId) clearInterval(countdownIntervalId);
                    countdownIntervalId = setInterval(() => {
                        if (!isPaused) {
                            const elapsed = Math.floor((Date.now() - countdownStartTimestamp) / 1000);
                            remainingDelay = currentDelay - elapsed;
                            if (remainingDelay <= 0) {
                                clearInterval(countdownIntervalId);
                                timerDisplay.textContent = '';
                            } else {
                                timerDisplay.textContent = `Ronde en cours : ${remainingDelay} sec.`;
                            }
                        }
                    }, 1000);
                    timerDisplay.style.display = 'block';
                }

                //Pour lancer la ronde
                function rondeGo() {
                    rondeContinue = GM_getValue('rondeContinue', false);
                    if (!rondeContinue) {
                        if (countdownIntervalId) {
                            clearInterval(countdownIntervalId);
                            timerDisplay.textContent = '';
                        }
                        return;
                    }
                    if (isPaused) return;
                    if (hideEnabled && rondeHide) {
                        simulerClicSurBouton('boutonCacherToutHaut');
                    }
                    //Recherche du lien "suivant"
                    const suivant = document.querySelector('li.a-last > a[href^="/vine/vine-items?"]');
                    if (suivant) {
                        const randomAddition = Math.floor(Math.random() * rondeRandom);
                        const delaySeconds = parseInt(rondeDelay, 10) + parseInt(randomAddition, 10);

                        pageCount = GM_getValue('rondePageCount', 0) + 1;
                        GM_setValue('rondePageCount', pageCount);

                        startCountdown(delaySeconds);

                        timerId = setTimeout(() => {
                            suivant.click();
                        }, delaySeconds * 1000);
                    } else {
                        //Fin de la ronde (plus de lien "suivant")
                        GM_setValue('rondeContinue', false);
                        pageCount = GM_getValue('rondePageCount', 0) + 1;
                        if (countdownIntervalId) {
                            clearInterval(countdownIntervalId);
                            timerDisplay.textContent = '';
                        }
                        if (rondeResume) {
                            setTimeout(() => {
                                finalizeRound(false);
                            }, 300);
                        } else {
                            resetRound();
                        }
                    }
                }

                //Gestion du clic sur le bouton stop/play
                startStopButton.addEventListener('click', function() {
                    if (GM_getValue('rondeContinue', false)) {
                        //Ronde en cours ou en pause → arrêt volontaire
                        GM_setValue('rondeContinue', false);
                        if (timerId) {
                            clearTimeout(timerId);
                            timerId = null;
                        }
                        if (countdownIntervalId) {
                            clearInterval(countdownIntervalId);
                            timerDisplay.textContent = '';
                        }
                        startTime = null;
                        if (rondeResume) {
                            finalizeRound(true);
                        } else {
                            resetRound();
                        }
                    } else {
                        //Démarrage de la ronde
                        GM_setValue('rondeContinue', true);
                        if (!startTime) {
                            startTime = new Date();
                            GM_setValue('rondeStartTime', startTime.toISOString());
                        }
                        //Mise à jour de l'interface : affichage des icônes stop et pause
                        startStopButton.innerHTML = `<img src="${stopIcon}" alt="Stop" style="height:32px; width:auto;">`;
                        pauseButton.style.display = 'flex';
                        pauseButton.innerHTML = `<img src="${pauseIconUrl}" alt="Pause" style="height:32px; width:auto;">`;
                        if (
                            rondeFirst &&
                            window.location.href !== `https://www.amazon.fr/vine/vine-items?queue=${valeurQueue}` &&
                            window.location.href !== `https://www.amazon.fr/vine/vine-items?queue=${valeurQueue}&pn=&cn=&page=1`
                        ) {
                            window.location.href = `https://www.amazon.fr/vine/vine-items?queue=${valeurQueue}&pn=&cn=&page=1`;
                            return;
                        }
                        rondeGo();
                    }
                });

                //Gestion du clic sur le bouton pause/resume
                pauseButton.addEventListener('click', function() {
                    if (!isPaused) {
                        //Mise en pause
                        isPaused = true;
                        GM_setValue('rondeIsPaused', true);
                        const elapsed = Math.floor((Date.now() - countdownStartTimestamp) / 1000);
                        remainingDelay = currentDelay - elapsed;
                        GM_setValue('rondeRemainingDelay', remainingDelay);
                        if (timerId) {
                            clearTimeout(timerId);
                            timerId = null;
                        }
                        if (countdownIntervalId) {
                            clearInterval(countdownIntervalId);
                        }
                        //Passage du bouton en pause
                        pauseButton.innerHTML = `<img src="${playIcon}" alt="Resume" style="height:32px; width:auto;">`;
                        timerDisplay.textContent = `Ronde en pause`;
                    } else {
                        //Reprise de la ronde
                        isPaused = false;
                        GM_setValue('rondeIsPaused', false);
                        currentDelay = remainingDelay;
                        countdownStartTimestamp = Date.now();
                        startCountdown(remainingDelay);
                        timerId = setTimeout(() => {
                            const suivant = document.querySelector('li.a-last > a[href^="/vine/vine-items?"]');
                            if (suivant) {
                                suivant.click();
                            }
                        }, remainingDelay * 1000);
                        pauseButton.innerHTML = `<img src="${pauseIconUrl}" alt="Pause" style="height:32px; width:auto;">`;
                    }
                });

                //Si la ronde était déjà en cours au chargement de la page
                if (GM_getValue('rondeContinue', false)) {
                    //Affichage en cours → bouton stop et affichage du bouton pause
                    startStopButton.innerHTML = `<img src="${stopIcon}" alt="Stop" style="height:32px; width:auto;">`;
                    pauseButton.style.display = 'flex';
                    rondeGo();
                }

                //Si la ronde était en pause lors du chargement, on affiche le timer avec le temps restant
                if (isPaused && remainingDelay > 0) {
                    timerDisplay.textContent = `Ronde en pause`;
                    timerDisplay.style.display = 'block';
                }
            }
        }

        function alertRR() {
            if (localStorage.getItem('useRR') === '1') {
                alert("ReviewRemember a été détecté !\n\nDans cette version de PickMe, ReviewRemember n'est plus nécessaire (vos données ne seront pas perdues) et ne sera d'ailleurs plus mis à jour.\n\nPour profiter des nouveautés de ReviewRemember, voici comment le désactiver ou le supprimer :\n\n1. Cliquez sur l’icône Tampermonkey dans la barre du navigateur.\n2. Choisissez \"Tableau de bord\".\n3. Repérez le script \"ReviewRemember\" dans la liste.\n4. Cliquez sur l’icône de corbeille pour le supprimer, ou décochez la case pour le désactiver.\n\nEn cas de problème, n'hésitez pas à demander de l'aide sur le discord Amazon Vine FR.");
                localStorage.setItem('useRR', '0');
            }
        }

        //Fix iPhone
        if (document.readyState !== 'loading') {
            runPickMe();
            alertRR();
        }
        else {
            document.addEventListener('DOMContentLoaded', function () {
                runPickMe();
                alertRR();
            });
        }
    } catch (err) {
        console.error("[PickMe] Erreur :", err.message);
        //Equivalent de displayContent() pour éviter les pages blanches/noirs
        var styleElementHide = document.getElementById('hide-page-style');
        if (styleElementHide) {
            styleElementHide.parentNode.removeChild(styleElementHide);
        }
    }
})();
