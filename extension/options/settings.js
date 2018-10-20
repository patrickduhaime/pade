var uportWin = null, credWin = null;

window.addEventListener('message', function (event)
{
    console.log("addListener message", event.data);
});

window.addEventListener("unload", function ()
{
    if (uportWin) chrome.windows.remove(uportWin.id);
    if (credWin) chrome.windows.remove(credWin.id);
});

window.addEvent("domready", function () {

    chrome.windows.onRemoved.addListener(function(win)
    {
        if (uportWin && win == uportWin.id) uportWin = null;
        if (credWin && win == credWin.id) credWin = null;
    });

    document.getElementById("settings-label").innerHTML = chrome.i18n.getMessage('settings')

    doDefaults();

    new FancySettings.initWithManifest(function (settings)
    {
        var background = chrome.extension.getBackgroundPage();
        var avatar = getSetting("avatar");

        if (avatar)
        {
            document.getElementById("avatar").innerHTML = "<img style='width: 64px;' src='" + avatar + "' />";
        }

        settings.manifest.uploadAvatar.element.innerHTML = "<input id='uploadAvatar' type='file' name='files[]'>";

        document.getElementById("uploadAvatar").addEventListener('change', function(event)
        {
            uploadAvatar(event, settings);
        });

        settings.manifest.uploadApp.element.innerHTML = "<input id='uploadApplication' type='file' name='files[]'>";

        document.getElementById("uploadApplication").addEventListener('change', function(event)
        {
            uploadApplication(event, settings, background);
        });

        setDefaultPassword(settings);

        settings.manifest.connect.addEvent("action", function ()
        {
            settings.manifest.status.element.innerHTML = 'Please wait....';
            validateCredentials()
        });

        settings.manifest.convSearch.addEvent("action", function ()
        {
            var keyword = settings.manifest.convSearchString.element.value;

            background.searchConversations(keyword, function(html, conversations)
            {
                settings.manifest.convSearchResults.element.innerHTML = html;

                for (var i=0; i<conversations.length; i++)
                {
                    try {
                        document.getElementById("conversation-" + conversations[i].conversationID).addEventListener("click", function(e)
                        {
                            e.stopPropagation();

                            if (e.target.title && getSetting("enableInverse"))
                            {
                                if (background.pade.chatWindow)
                                {
                                    chrome.extension.getViews({windowId: background.pade.chatWindow.id})[0].openChatPanel(e.target.title);
                                }
                                else {
                                    background.openChatsWindow("inverse/index.html#converse/chat?jid=" + e.target.title);
                                }
                            }
                        }, false);

                    } catch (e) {

                    }
                }
            });
        });

        settings.manifest.search.addEvent("action", function ()
        {
            background.findUsers(settings.manifest.searchString.element.value, function(users)
            {
                console.log("findUsers", users);

                var html = "<table><tr><th>Name</th><th>ID</th><th>Email</th><th>Invite</th></tr>";
                var count = 0;

                for (var i=0; i<users.length; i++)
                {
                    var user = users[i];
                    var checked = settings.manifest.invitationList.element.value.indexOf(user.jid) > -1 ? "checked" : "";

                    html = html + "<tr><td><a title='" + user.name + "' name='" + user.room + "' id='" + user.jid + "' href='#'>" + user.name + "</a></td><td>" + user.jid + "</td><td>" + user.email + "</td><td><input id='check-" + user.jid + "' type='checkbox' " + checked + "></td></tr>";
                }
                html = html + "</table>"

                if (users.length == 0) html = "No user found";

                settings.manifest.searchResults.element.innerHTML = "<p/><p/>" + html;

                for (var i=0; i<users.length; i++)
                {
                    document.getElementById(users[i].jid).addEventListener("click", function(e)
                    {
                        e.stopPropagation();
                        var user = e.target;

                        //console.log("findUsers - click", user.id, user.name, user.title);

                        if (getSetting("enableInverse"))
                        {
                            if (background.pade.chatWindow)
                            {
                                chrome.extension.getViews({windowId: background.pade.chatWindow.id})[0].openChat(user.id, user.title);
                            }
                            else {
                                background.openChatsWindow("inverse/index.html#converse/chat?jid=" + user.id, user.title);
                            }
                        }
                        else {
                            background.acceptCall(user.title, user.id, user.name);
                            background.inviteToConference(user.id, user.name);
                        }
                    });

                    document.getElementById("check-" + users[i].jid).addEventListener("click", function(e)
                    {
                        e.stopPropagation();
                        var invitation = e.target;

                        console.log("inviteUser - click", invitation.id, invitation.checked);

                        var inviteList = settings.manifest.invitationList.element.value.split("\n");
                        var invitee = invitation.id.substring(6);

                        if (invitation.checked)
                        {
                            if (inviteList.indexOf(invitee) == -1) inviteList.push(invitee);

                        } else {
                            var index = inviteList.indexOf(invitee);
                            if (index > -1) inviteList.splice(index, 1);
                        }

                        settings.manifest.invitationList.element.value = inviteList.join("\n").trim();
                    });
                }
            });
        });

        settings.manifest.inviteToMeeting.addEvent("action", function ()
        {
            var inviteList = settings.manifest.invitationList.element.value.split("\n");
            var room = "pade-" + Math.random().toString(36).substr(2,9);

            console.log("inviteToMeeting", inviteList, room);

            background.acceptCall(null, null, room);

            for (var i=0; i<inviteList.length; i++)
            {
                background.inviteToConference(inviteList[i], room);
            }
        });

        settings.manifest.popupWindow.addEvent("action", function ()
        {
            if (getSetting("popupWindow"))
            {
                chrome.browserAction.setPopup({popup: ""});

            } else {
                chrome.browserAction.setPopup({popup: "popup.html"});
            }
        });

        settings.manifest.enableCommunity.addEvent("action", function ()
        {
            if (getSetting("enableCommunity"))
            {
                background.addCommunityMenu();

            } else {
               background.removeCommunityMenu();
            }
        });

        settings.manifest.enableInverse.addEvent("action", function ()
        {
            if (getSetting("enableInverse"))
            {
                background.addInverseMenu();

            } else {
               background.removeInverseMenu();
            }

            background.reloadApp();
        });

        settings.manifest.enableTouchPad.addEvent("action", function ()
        {
            if (getSetting("enableTouchPad"))
            {
                background.addTouchPadMenu();

            } else {
               background.removeTouchPadMenu();
            }

            location.reload()
        });

        settings.manifest.useStreamDeck.addEvent("action", function ()
        {
            location.reload()
        });

        settings.manifest.enableOffice365Business.addEvent("action", function ()
        {
            if (getSetting("enableOffice365Business"))
            {
                background.addOffice365Business();

            } else {
               background.removeOffice365Business();
            }
        });

        settings.manifest.enableOffice365Personal.addEvent("action", function ()
        {
            if (getSetting("enableOffice365Personal"))
            {
                background.addOffice365Personal();

            } else {
               background.removeOffice365Personal();
            }
        });

        settings.manifest.enableWebApps.addEvent("action", function ()
        {
            if (getSetting("enableWebApps"))
            {
                background.addWebApps();

            } else {
               background.removeWebApps();
            }
        });

        settings.manifest.enableGmail.addEvent("action", function ()
        {
            if (getSetting("enableGmail"))
            {
                background.addGmail();

            } else {
               background.removeGmail();
            }
        });

        settings.manifest.changelog.addEvent("action", function ()
        {
            location.href = "../changelog.html";
        });

        settings.manifest.help.addEvent("action", function ()
        {
            location.href = chrome.runtime.getManifest().homepage_url;
        });

        settings.manifest.enableSip.addEvent("action", function ()
        {
            background.reloadApp();
        });

        settings.manifest.useTotp.addEvent("action", function ()
        {
            background.reloadApp();
        });

        settings.manifest.useWinSSO.addEvent("action", function ()
        {
            setSetting("password", "__DEFAULT__WINSSO__")
            background.reloadApp();
        });

        settings.manifest.enableRemoteControl.addEvent("action", function ()
        {
            background.reloadApp();
        });

        settings.manifest.useClientCert.addEvent("action", function ()
        {
            setDefaultPassword(settings);
            background.reloadApp();
        });

        settings.manifest.enableBlog.addEvent("action", function ()
        {
            if (getSetting("enableBlog"))
            {
                background.addBlogMenu();

            } else {
               background.removeBlogMenu();
            }
        });

        settings.manifest.enableBlast.addEvent("action", function ()
        {
            if (getSetting("enableBlast"))
            {
                background.addBlastMenu();

            } else {
               background.removeBlastMenu();
            }
        });

        settings.manifest.enableAVCapture.addEvent("action", function ()
        {
            if (getSetting("enableAVCapture"))
            {
                background.addAVCaptureMenu();

            } else {
               background.removeAVCaptureMenu();
            }
        });

        settings.manifest.enableVerto.addEvent("action", function ()
        {
            if (getSetting("enableVerto"))
            {
                background.addVertoMenu();

            } else {
               background.removeVertoMenu();
            }
        });

        settings.manifest.desktopShareMode.addEvent("action", function ()
        {
            background.reloadApp();
        });

        settings.manifest.showOnlyOnlineUsers.addEvent("action", function ()
        {
            background.reloadApp();
        });

        settings.manifest.useCredsMgrApi.addEvent("action", function ()
        {
            background.reloadApp();
        });

        settings.manifest.qrcode.addEvent("action", function ()
        {
            if (window.localStorage["store.settings.server"])
            {
                var host = JSON.parse(window.localStorage["store.settings.server"]);
                var url = "https://" + host + "/dashboard/qrcode.jsp";

                chrome.windows.create({url: url, focused: true, type: "popup"}, function (win)
                {
                    chrome.windows.update(win.id, {drawAttention: true, width: 400, height: 270});
                });
            }
        });


        settings.manifest.registerUrlProtocols.addEvent("action", function ()
        {
            if (getSetting("registerIMProtocol"))
            {
                navigator.registerProtocolHandler("im",  chrome.extension.getURL("inverse/index.html?url=%s"), "Pade - Conversation");
            }

            if (getSetting("registerXMPPProtocol"))
            {
                navigator.registerProtocolHandler("xmpp",  chrome.extension.getURL("inverse/index.html?url=%s"), "Pade - Meeting");
            }

            if (getSetting("registerSIPProtocol"))
            {
                navigator.registerProtocolHandler("sip",  chrome.extension.getURL("webcam/sip-video.html?url=%s"), "Pade - SIP VideoConference");
            }

            if (getSetting("registerTELProtocol"))
            {
                navigator.registerProtocolHandler("tel",  chrome.extension.getURL("phone/index-ext.html?url=%s"), "Pade - Phone");
            }

            if (getSetting("registerMEETProtocol"))
            {
                navigator.registerProtocolHandler("web+meet",  chrome.extension.getURL("jitsi-meet/chrome.index.html?url=%s"), "Pade - Meeting");
            }
        });

        settings.manifest.uport.addEvent("action", function ()
        {
            if (getSetting("useUport"))
            {
                if (uportWin)
                {
                    chrome.windows.update(uportWin.id, {drawAttention: true, focused: true});

                } else {
                    var url = chrome.extension.getURL("uport/index.html");

                    chrome.windows.create({url: url, focused: true, type: "popup"}, function (win)
                    {
                        uportWin = win;
                        chrome.windows.update(win.id, {drawAttention: true, width: 500, height: 700});
                    });
                }
            }
        });

        settings.manifest.certificate.addEvent("action", function ()
        {
            if (window.localStorage["store.settings.server"])
            {
                var host = JSON.parse(window.localStorage["store.settings.server"]);
                var username = JSON.parse(window.localStorage["store.settings.username"]);
                var password = getPassword(JSON.parse(window.localStorage["store.settings.password"]));

                var url =  "https://" + host + "/rest/api/restapi/v1/chat/certificate";
                var options = {method: "GET", headers: {"authorization": "Basic " + btoa(username + ":" + password)}};

                console.log("fetch", url, options);

                fetch(url, options).then(function(response){ return response.blob()}).then(function(blob)
                {
                    chrome.downloads.download({url: URL.createObjectURL(blob)});

                }).catch(function (err) {
                    console.error('connection error', err);
                });

            }
        });


        function validateCredentials()
        {
            if (window.localStorage["store.settings.server"] && window.localStorage["store.settings.domain"] && window.localStorage["store.settings.username"] && window.localStorage["store.settings.password"])
            {
                var lynks = {};

                lynks.server = JSON.parse(window.localStorage["store.settings.server"]);
                lynks.domain = JSON.parse(window.localStorage["store.settings.domain"]);
                lynks.username = JSON.parse(window.localStorage["store.settings.username"]);
                lynks.displayname = JSON.parse(window.localStorage["store.settings.displayname"]);
                lynks.password = getPassword(JSON.parse(window.localStorage["store.settings.password"]));

                if (lynks.server && lynks.domain && lynks.username && lynks.password)
                {
                    var connection = background.getConnection("https://" + lynks.server + "/http-bind/");

                    connection.connect(lynks.username + "@" + lynks.domain + "/" + lynks.username, lynks.password, function (status)
                    {
                        //console.log("status", status, lynks.username, lynks.password, lynks.displayname);

                        if (status === 5)
                        {
                            setTimeout(function() { background.reloadApp(); }, 1000);
                        }
                        else

                        if (status === 4)
                        {
                            setDefaultPassword(settings);
                            settings.manifest.status.element.innerHTML = '<b>bad username or password</b>';
                        }
                    });
                }
                else {
                    if (!lynks.server) settings.manifest.status.element.innerHTML = '<b>bad server</b>';
                    if (!lynks.domain) settings.manifest.status.element.innerHTML = '<b>bad domain</b>';
                    if (!lynks.username) settings.manifest.status.element.innerHTML = '<b>bad username</b>';
                    if (!lynks.password) settings.manifest.status.element.innerHTML = '<b>bad password</b>';
                }

            } else settings.manifest.status.element.innerHTML = '<b>bad server, domain, username or password</b>';
        }
    });


});

function doDefaults()
{
    // connection
    setSetting("uportPermission", chrome.i18n.getMessage("uport_permission"));
    setSetting("server", chrome.i18n.getMessage("openfire_server"));
    setSetting("domain", chrome.i18n.getMessage("openfire_domain"));
    setSetting("useWebsocket", true);

    // preferences
    setSetting("language", "en");
    setSetting("popupWindow", true);
    setSetting("enableLipSync", false);
    setSetting("enableCommunity", false);
    setSetting("audioOnly", false);
    setSetting("enableSip", false);
    setSetting("enableBlog", false);

    // config
    setSetting("startBitrate", 800);
    setSetting("resolution", 720);
    setSetting("minHDHeight", 540);

    // meeting
    setSetting("VERTICAL_FILMSTRIP", true);
    setSetting("FILM_STRIP_MAX_HEIGHT", 90);
    setSetting("INITIAL_TOOLBAR_TIMEOUT", 20000);
    setSetting("TOOLBAR_TIMEOUT", 4000);
    setSetting("p2pMode", true);

    // community
    setSetting("chatWithOnlineContacts", true);
    setSetting("notifyWhenMentioned", true);

    // converse
    setSetting("enableInverse", true);
    setSetting("allowNonRosterMessaging", true);
    setSetting("autoReconnect", true);
    setSetting("messageCarbons", true);
    setSetting("converseAutoStart", true);
    setSetting("showGroupChatStatusMessages", true);

    // web apps
    setSetting("webApps", "web.skype.com, web.whatsapp.com");
}

function setDefaultPassword(settings)
{
    settings.manifest.password.element.disabled = false;

    if (settings.manifest.useClientCert.element.checked)
    {
        settings.manifest.password.element.disabled = true;
        setSetting("password", settings.manifest.username.element.value);
    }
}

function setSetting(name, defaultValue)
{
    console.log("setSetting", name, defaultValue);

    if (!window.localStorage["store.settings." + name])
    {
        if (defaultValue) window.localStorage["store.settings." + name] = JSON.stringify(defaultValue);
    }
}

function getSetting(name)
{
    //console.log("getSetting", name);
    var value = null;

    if (window.localStorage["store.settings." + name])
    {
        value = JSON.parse(window.localStorage["store.settings." + name]);
    }

    return value;
}

function removeSetting(name)
{
    localStorage.removeItem("store.settings." + name);
}

function getPassword(password)
{
    if (!password || password == "") return null;
    if (password.startsWith("token-")) return atob(password.substring(6));

    window.localStorage["store.settings.password"] = JSON.stringify("token-" + btoa(password));
    return password;
}

function uploadApplication(event, settings, background)
{
    //console.log("uploadApplication", event);

    if (window.localStorage["store.settings.server"] && window.localStorage["store.settings.username"] && window.localStorage["store.settings.password"])
    {
        var files = event.target.files;
        var server = JSON.parse(window.localStorage["store.settings.server"]);
        var username = JSON.parse(window.localStorage["store.settings.username"]);
        var password = getPassword(JSON.parse(window.localStorage["store.settings.password"]));

        for (var i = 0, file; file = files[i]; i++)
        {
            console.log("upload", file);

            if (file.name.endsWith(".zip") || file.name.endsWith(".h5p"))
            {
                var putUrl = "https://" + server + "/dashboard/upload?name=" + file.name + "&username=" + username;
                var req = new XMLHttpRequest();

                req.onreadystatechange = function()
                {
                  if (this.readyState == 4 && this.status >= 200 && this.status < 400)
                  {
                    console.log("pade.upload.app", this.statusText);
                    settings.manifest.uploadStatus.element.innerHTML = '<b>' + this.statusText + '</b>';

                    setTimeout(function()
                    {
                         background.reloadApp();

                    }, 2000);
                  }
                  else

                  if (this.readyState == 4 && this.status >= 400)
                  {
                    console.error("pade.upload.error", this.statusText);
                    settings.manifest.uploadStatus.element.innerHTML = '<b>' + this.statusText + '</b>';
                  }

                };
                req.open("PUT", putUrl, true);
                req.setRequestHeader("Authorization", 'Basic ' + btoa(username+':'+password));
                req.send(file);
            } else {
                settings.manifest.uploadStatus.element.innerHTML = '<b>application file must be a zip file</b>';
            }
        }

    } else {
        settings.manifest.uploadStatus.element.innerHTML = '<b>user not configured</b>';
    }
}

function uploadAvatar(event, settings)
{
    settings.manifest.uploadAvatarStatus.element.innerHTML = "Please wait...";

    var files = event.target.files;
    var background = chrome.extension.getBackgroundPage();

    var domain = JSON.parse(window.localStorage["store.settings.domain"]);
    var username = JSON.parse(window.localStorage["store.settings.username"]);
    var jid = username + "@" + domain

    for (var i = 0, file; file = files[i]; i++)
    {
        if (file.name.endsWith(".png") || file.name.endsWith(".jpg"))
        {
            var reader = new FileReader();

            reader.onload = function(event)
            {
                dataUri = event.target.result;
                console.log("uploadAvatar", dataUri);

                window.localStorage["store.settings.avatar"] = JSON.stringify(dataUri);

                var sourceImage = new Image();

                sourceImage.onload = function() {
                    var canvas = document.createElement("canvas");
                    canvas.width = 32;
                    canvas.height = 32;
                    canvas.getContext("2d").drawImage(sourceImage, 0, 0, 32, 32);

                    background.getVCard(jid, function(vCard)
                    {
                        console.log("uploadAvatar - get vcard", vCard);
                        vCard.avatar = canvas.toDataURL();

                        background.setVCard(vCard, function(resp)
                        {
                            console.log("uploadAvatar - set vcard", resp);
                            setTimeout(function() {location.reload();}, 500);

                        }, avatarError);

                    }, avatarError);
                }

                sourceImage.src = dataUri;
            };

            reader.onerror = function(event) {
                console.error("uploadAvatar - error", event);
                settings.manifest.uploadAvatarStatus.element.innerHTML = '<b>File could not be read! Code ' + event.target.error.code;
            };

            reader.readAsDataURL(file);

        } else {
            settings.manifest.uploadAvatarStatus.element.innerHTML = '<b>image file must be a png or jpg file</b>';
        }
    }
}


function avatarError(error)
{
    console.error("uploadAvatar - error", error);
    settings.manifest.uploadAvatarStatus.element.innerHTML = '<b>picture/avatar cannot be uploaded and saved</b>';
}