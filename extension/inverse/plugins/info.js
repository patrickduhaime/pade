(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["converse"], factory);
    } else {
        factory(converse);
    }
}(this, function (converse) {
    var bgWindow = chrome.extension ? chrome.extension.getBackgroundPage() : null;
    var _converse = null;
    var infoDialog = null;
    var Strophe = converse.env.Strophe;
    var $iq = converse.env.$iq;
    var moment = converse.env.moment;

    converse.plugins.add("info", {
        'dependencies': [],

        'initialize': function () {
            _converse = this._converse;

            PreviewDialog = _converse.BootstrapModal.extend({
                initialize() {
                    _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                    this.model.on('change', this.render, this);
                },
                toHTML() {
                  return '<div class="modal" id="myModal"> <div class="modal-dialog modal-lg"> <div class="modal-content">' +
                         '<div class="modal-header"><h1 class="modal-title">Media Content Preview</h1><button type="button" class="close" data-dismiss="modal">&times;</button></div>' +
                         '<div class="modal-body"></div>' +
                         '<div class="modal-footer"><button type="button" class="btn btn-danger" data-dismiss="modal">Close</button></div>' +
                         '</div> </div> </div>';
                },
                afterRender() {

                    if (this.model.get("type") == "image")
                    {
                        this.el.querySelector('.modal-body').innerHTML = '<img class="pade-preview-image" src="' + this.model.get("url") + '"/>';
                    }
                    else

                    if (this.model.get("type") == "video")
                    {
                        this.el.querySelector('.modal-body').innerHTML = '<video controls class="pade-preview-image" src="' + this.model.get("url") + '"/>';
                    }
                    else

                    if (this.model.get("type") == "audio")
                    {
                        this.el.querySelector('.modal-body').innerHTML = '<audio controls class="pade-preview-image" src="' + this.model.get("url") + '"/>';
                    }

                    this.el.querySelector('.modal-title').innerHTML = "Media Content Preview<br/>" + this.model.get("url");
                },
                events: {
                    "click .btn-danger": "clearIframe",
                },

                clearIframe() {
                    this.el.querySelector('.modal-body').innerHTML = "about:blank";
                }
            });

            _converse.api.listen.on('renderToolbar', function(view)
            {
                if (view.model.get("type") === "chatroom" && !view.el.querySelector(".fa-info"))
                {
                    var jid = view.model.get("jid");
                    var id = view.model.get("box_id");

                    addToolbarItem(view, id, "pade-info-" + id, '<a class="fas fa-info" title="Information"></a>');

                    var occupants = view.el.querySelector('.occupants');

                    if (occupants)
                    {
                        var infoElement = occupants.insertAdjacentElement('afterEnd', __newElement('div', null, null, 'plugin-infobox'));
                        infoElement.style.display = "none";

                        var infoButton = document.getElementById("pade-info-" + id);

                        if (infoButton) infoButton.addEventListener('click', function(evt)
                        {
                            evt.stopPropagation();
                            toggleInfoBar(view, infoElement, id, jid);

                        }, false);
                    }
                }
            });

            console.log("info plugin is ready");
        },

        'overrides': {
            ChatBoxView: {

                parseMessageForCommands: function(text) {
                    console.debug('info - parseMessageForCommands', text);

                    const match = text.replace(/^\s*/, "").match(/^\/(.*?)(?: (.*))?$/) || [false, '', ''];
                    const command = match[1].toLowerCase();
                    const view = this;

                    if (command === "info")
                    {
                        var id = this.model.get("box_id");
                        var jid = this.model.get("jid");
                        var infoElement = this.el.querySelector('.plugin-infobox');
                        if (infoElement) toggleInfoBar(this, infoElement, id, jid);
                        return true;
                    }
                    else

                    if (command === "feed" && this.model.get("type") == "chatroom")
                    {
                        if (!match[2])
                        {
                            alert("Missing Feed URL. Try /feed <url>");
                            return true;
                        }

                        const id = this.model.get("box_id");
                        const feedId = 'feed-' + id;

                        chrome.storage.local.get(feedId, function(data)
                        {
                            if (!data) data = {};
                            if (!data[feedId]) data[feedId] = {};

                            var feed = {path:  match[2]};

                            fetch(feed.path).then(function(response)
                            {
                                if (response.ok)
                                {
                                    return response.text().then(function(body)
                                    {
                                        var parser = new RSSParser(feed);
                                        parser.setResult(body);

                                        parser.parse(function(parser)
                                        {
                                            data[feedId][feed.path] = {url: feed.path, title: feed.title};

                                            chrome.storage.local.set(data, function(data)
                                            {
                                                console.log("feed stored ok", feedId, data);

                                                view.close();
                                                _converse.api.rooms.open(view.model.get("jid"));

                                                alert("Feed " + feed.title + " added\n" + feed.path);
                                            });
                                        });
                                    });
                                } else {
                                    alert("Bad Feed URL \n" + feed.path);
                                    console.error("RSSParser", response)
                                }
                            }).catch(function (err) {
                                alert("Cannot fetch Feed URL \n" + feed.path);
                                console.error("RSSParser", err)
                            });
                        });

                        return true;
                    }
                    else

                    if (command === "clearpins")
                    {
                        var id = this.model.get("box_id");
                        var jid = this.model.get("jid");

                        chrome.storage.local.get('pinned', function(data)
                        {
                            console.debug('chrome.storage get', data);

                            let pinned = {};
                            if (data && data.pinned) pinned = data.pinned;
                            const keys = Object.getOwnPropertyNames(pinned);

                            for (var i=0; i<keys.length; i++)
                            {
                                const item = pinned[keys[i]];
                                if (item.from == jid) delete pinned[keys[i]];
                            }

                            chrome.storage.local.set({pinned: pinned}, function() {
                              console.debug('chrome.storage is set for pinned', pinned);
                            });
                        });

                        return true;
                    }

                    return this.__super__.parseMessageForCommands.apply(this, arguments);
                }
            }
        }
    });

    var toggleInfoBar = function(view, infoElement, id, jid)
    {
        var chat_area = view.el.querySelector('.chat-area');

        if (infoElement.style.display == "none")
        {
            infoElement.style.display = "";
            removeClass('full', chat_area);
            removeClass('col-12', chat_area);
            addClass('col-md-9', chat_area);
            addClass('col-8', chat_area);
            addClass('hidden', view.el.querySelector('.occupants'));

            infoElement.innerHTML = getHTML(id, jid);

            createContentSummary(view, jid, id);
            createMediaContentSummary(jid, id);

            if (bgWindow && bgWindow.pade.activeWorkgroup)
            {
                createWorkgroups(jid, id);
            }

            createMylinks(jid, id);
            createBroadcastEndpoints(jid, id);

        } else {
            infoElement.style.display = "none"
            removeClass('col-md-9', chat_area);
            removeClass('col-8', chat_area);
            addClass('full', chat_area);
            addClass('col-12', chat_area);
            hideElement(view.el.querySelector('.occupants'));
        }
        view.scrollDown();
    }

    var postMessage = function(view, text, spoiler_hint)
    {
        const attrs = view.model.getOutgoingMessageAttributes("*" + text + "*", spoiler_hint);
        view.model.messages.create(attrs);
    }

    var createMylinks = function(jid, id)
    {
        if (bgWindow && bgWindow.pade.collabDocs)
        {
            var urls = Object.getOwnPropertyNames(bgWindow.pade.collabDocs);

            if (urls.length > 0)
            {
                var h5pCount = document.getElementById(id + "-h5p-count");
                var h5pDetail = document.getElementById(id + "-h5p-details");
                var pdfCount = document.getElementById(id + "-pdf-count");
                var pdfDetail = document.getElementById(id + "-pdf-details");
                var appsCount = document.getElementById(id + "-apps-count");
                var appsDetail = document.getElementById(id + "-apps-details");

                var h5pHtml = "", h5pKount = 0, pdfHtml = "", pdfKount = 0, appsHtml = "", appsKount = 0;

                for (var i=0; i<urls.length; i++)
                {
                    var urlName = bgWindow.pade.collabDocs[urls[i]];
                    console.debug('createMylinks', urls[i], urlName);

                    if (urlName != "Video conferencing web client")
                    {
                        if (isH5PURL(urls[i]))
                        {
                            h5pKount++;
                            var checked = bgWindow.pade.activeH5p == urls[i] ? "checked" : "";
                            h5pHtml += '<div title="' + urlName + '" class="mediaItem"><input name="info_h5p_url" class="info_active_url" ' + checked + ' type="radio" value="' + urls[i] + '"/>&nbsp;' + urlName + '</div>';

                        }
                        else

                        if (isPDFURL(urls[i]))
                        {
                            pdfKount++;
                            var checked = bgWindow.pade.activeUrl == urls[i] ? "checked" : "";
                            pdfHtml += '<div title="' + urlName + '" class="mediaItem"><input name="info_url" class="info_active_url" ' + checked + ' type="radio" value="' + urls[i] + '"/>&nbsp;' + urlName + '</div>';

                        }
                        else {
                            appsKount++;
                            var checked = bgWindow.pade.activeUrl == urls[i] ? "checked" : "";
                            appsHtml += '<div title="' + urlName + '" class="mediaItem"><input name="info_url" class="info_active_url" ' + checked + ' type="radio" value="' + urls[i] + '"/>&nbsp;' + urlName + '</div>';
                        }
                    }
                }

                if (h5pCount) h5pCount.innerHTML = h5pKount;
                if (pdfCount) pdfCount.innerHTML = pdfKount;
                if (appsCount) appsCount.innerHTML = appsKount;

                var htmlArray = [{html: h5pHtml, ele: h5pDetail}, {html: pdfHtml, ele: pdfDetail}, {html: appsHtml, ele: appsDetail}];

                for (var i = 0; i < htmlArray.length; i++)
                {
                    if (htmlArray[i].ele)
                    {
                        var element = __newElement('div', null, htmlArray[i].html);
                        htmlArray[i].ele.insertAdjacentElement('afterEnd', element);

                        element.addEventListener('click', function(evt)
                        {
                            evt.stopPropagation();

                            var activeUrls = document.getElementsByClassName("info_active_url");

                            for (var k=0; k<activeUrls.length; k++)
                            {
                                console.debug("createMylinks click", activeUrls[k].value, activeUrls[k].checked);

                                if (activeUrls[k].checked)
                                {
                                    if (activeUrls[k].value.indexOf("/h5p/") > -1)
                                    {
                                        bgWindow.pade.activeH5p = activeUrls[k].value;
                                    }
                                    else {
                                        bgWindow.pade.activeUrl = activeUrls[k].value;
                                    }
                                }
                            }
                        });
                    }
                }

            }
        }
    }

    var createBroadcastEndpoints = function(jid, id)
    {
        console.debug("createBroadcastEndpoints", jid, id);

        _converse.connection.sendIQ($iq({type: 'get', to: "broadcast." + _converse.connection.domain}).c('query', {xmlns: "http://jabber.org/protocol/disco#items"}).tree(), function(resp)
        {
            var count = document.getElementById(id + "-broadcast-count");
            var detail = document.getElementById(id + "-broadcast-details");
            var items = resp.querySelectorAll('item');

            if (count && detail)
            {
                count.innerHTML = items.length;

                for (var i=0; i<items.length; i++)
                {
                    var jid = items[i].getAttribute('jid');
                    var name = Strophe.getNodeFromJid(jid);

                    console.debug('createBroadcastEndpoints', jid, name);

                    var html = '<li title="' + jid + '">' + name + '</li>';
                    var element = __newElement('div', null, html);

                    element.addEventListener('click', function(evt)
                    {
                        evt.stopPropagation();

                        console.debug("createBroadcastEndpoints click", evt.target.title);
                        _converse.api.chats.open(evt.target.title);
                    });

                    detail.insertAdjacentElement('afterEnd', element);
                }
            }

        }, function (error) {
             console.warn("Broadcast plugin not available");
        });
    }

    var createWorkgroups = function(jid, id)
    {
        console.debug("createWorkgroups", jid, id);

        if (jid.startsWith("workgroup-"))
        {
            var workGroup = jid.split("@")[0].substring(10);

            _converse.connection.sendIQ($iq({type: 'get', to: "workgroup." + _converse.connection.domain}).c('workgroups', {jid: _converse.connection.jid, xmlns: "http://jabber.org/protocol/workgroup"}).tree(), function(resp)
            {
                var workgroups = resp.querySelectorAll('workgroup');
                var count = document.getElementById(id + "-wg-others-count");

                if (count) count.innerHTML = workgroups.length;

                var detail = document.getElementById(id + "-wg-others-details");

                if (bgWindow && detail)
                {
                    var html = "";

                    for (var i=0; i<workgroups.length; i++)
                    {
                        var jid = workgroups[i].getAttribute('jid');
                        var name = Strophe.getNodeFromJid(jid);
                        var room = 'workgroup-' + name + "@conference." + _converse.connection.domain;
                        var checked = bgWindow.pade.activeWorkgroup.jid == jid ? "checked" : "";

                        console.debug("get workgroups", room, jid);
                        html += '<input name="info_active_workgroup" type="radio" ' + checked + ' value="' + jid + '"/>&nbsp;' + name + '<br/>';
                    }

                    var element = __newElement('div', null, html);

                    element.addEventListener('click', function(evt)
                    {
                        evt.stopPropagation();

                        var activeWorkgroup = document.getElementsByName("info_active_workgroup");

                        for (var i=0; i<activeWorkgroup.length; i++)
                        {
                            console.debug("createWorkgroups other click", activeWorkgroup[i].value, activeWorkgroup[i].checked);
                            if (activeWorkgroup[i].checked) bgWindow.setActiveWorkgroup(bgWindow.pade.participants[activeWorkgroup[i].value]);
                        }
                    });

                    detail.insertAdjacentElement('afterEnd', element);
                }

            }, function (error) {
                console.warn("Workgroups not available");
            });

            if (bgWindow && bgWindow.pade.fastpath[workGroup])
            {
                console.debug("createWorkgroups", workGroup, bgWindow.pade.fastpath[workGroup]);

                var fastpath = bgWindow.pade.fastpath[workGroup];
                var queueCount = document.getElementById(id + "-wg-queue-count");

                if (queueCount) queueCount.innerHTML = fastpath.count;

                var queueDetail = document.getElementById(id + "-wg-queue-details");

                if (queueDetail)
                {
                    var html = '<table>';
                    var props = Object.getOwnPropertyNames(fastpath);

                    for (var i=0; i<props.length; i++)
                    {
                        if (props[i] == "oldest" || props[i] == "joinTime")
                        {
                            var moment_time = fastpath[props[i]];
                            moment_time = moment_time.substring(0,4) + "-" + moment_time.substring(4,6) + "-" + moment_time.substring(6);
                            html += '<tr><td>' + props[i] + '</td><td>' + moment(moment_time).fromNow() + '</td></tr>'
                        }
                        else

                        if (props[i] != "conversations")
                        {
                            html += '<tr><td>' + props[i] + '</td><td>' + fastpath[props[i]] + '</td></tr>'
                        }

                    }
                    html += '</table>';

                    queueDetail.insertAdjacentElement('afterEnd', __newElement('div', null, html));
                }

                var keys = Object.getOwnPropertyNames(fastpath.conversations);
                var chatsDetail = document.getElementById(id + "-wg-chats-details");
                var chatsCount = document.getElementById(id + "-wg-chats-count");

                if (chatsCount) chatsCount.innerHTML = keys.length;


                if (chatsDetail)
                {
                    for (var k=0; k<keys.length; k++)
                    {
                        var conversation = fastpath.conversations[keys[k]];

                        console.debug("createWorkgroups conversation", conversation);

                        var html = '<li title="' + conversation.question + '">' + conversation.username + ' (' + conversation.agent + ')</li>';
                        var element = __newElement('div', null, html);

                        element.addEventListener('click', function(evt)
                        {
                            evt.stopPropagation();

                            console.debug("createWorkgroups click", evt.target.title);
                            _converse.api.rooms.open(evt.target.title);

                        });

                        chatsDetail.insertAdjacentElement('afterEnd', element);
                    }
                }
            }
        }
    }

    var createContentSummary = function(view, jid, id)
    {
        console.debug("createContentSummary", jid, id);

        if (chrome.storage)
        {
            let pinned = {};

            chrome.storage.local.get('pinned', function(data)
            {
                console.debug('chrome.storage get pinned', data);

                if (data && data.pinned) pinned = data.pinned;
                const keys = Object.getOwnPropertyNames(pinned);
                const count = document.getElementById(id + "-pinned-count");
                const detail = document.getElementById(id + "-pinned-details");

                if (detail && count && keys.length > 0)
                {
                    let counter = 0;

                    for (var i=0; i<keys.length; i++)
                    {
                        const item = pinned[keys[i]];

                        if (item.from == jid)
                        {
                            detail.insertAdjacentElement('afterEnd', newPinnedItemElement('li', item, "mediaItem"));
                            counter++;
                        }
                    }
                    count.innerHTML = counter;
                }

            });

            const feedId = 'feed-' + id;

            chrome.storage.local.get(feedId, function(data)
            {
                console.debug('chrome.storage get feed', data);

                if (data && data[feedId])
                {
                    const keys = Object.getOwnPropertyNames(data[feedId]);
                    const count = document.getElementById(id + "-feed-count");
                    const detail = document.getElementById(id + "-feed-details");

                    if (detail && count && keys.length > 0)
                    {
                        let counter = 0;

                        for (var i=0; i<keys.length; i++)
                        {
                            detail.insertAdjacentElement('afterEnd', newFeedItemElement('li', data[feedId][keys[i]], "mediaItem", id, view));
                            counter++;
                        }
                        count.innerHTML = counter;
                    }
                }

            });
        }
    }

    var newPinnedItemElement = function(el, item, className)
    {
        console.debug('newPinnedItemElement', item);
        // {from: from, msgId: msgId, message: pinnedMessage, nick : nick}

        item.ele = document.createElement(el);

        item.ele.name = item.msgId;
        item.ele.title = item.nick + " says " + item.message;
        item.ele.innerHTML = item.message;
        item.ele.classList.add(className);
        document.body.appendChild(item.ele);

        item.ele.addEventListener('click', function(evt)
        {
            evt.stopPropagation();
            console.debug("pinned item clicked", evt.target.name, evt.target.title);

            var elmnt = document.getElementById("msg-" + evt.target.name);
            if (elmnt) elmnt.scrollIntoView({block: "end", inline: "nearest", behavior: "smooth"});
        });

        return item.ele;
    }

    var newFeedItemElement = function(el, item, className, id, view)
    {
        console.debug('newFeedItemElement', item, id);
        // {url: url, title: title}

        item.ele = document.createElement(el);

        item.ele.setAttribute("data-id", id);
        item.ele.setAttribute("data-url", item.url);

        item.ele.title = item.title;
        item.ele.innerHTML = item.url;
        item.ele.classList.add(className);
        document.body.appendChild(item.ele);

        item.ele.addEventListener('click', function(evt)
        {
            evt.stopPropagation();

            const id = evt.target.getAttribute("data-id");
            const url = evt.target.getAttribute("data-url");

            console.debug("feed item clicked", id, url);

            if (confirm("Do you wish to remove feed " + evt.target.title + "\n" + url))
            {
                const feedId = 'feed-' + id;

                chrome.storage.local.get(feedId, function(data)
                {
                    if (data && data[feedId] && data[feedId][url])
                    {
                        delete data[feedId][url]

                        chrome.storage.local.set(data, function(data)
                        {
                            console.log("feed stored ok", feedId, data);
                            alert("Feed " + evt.target.title + " removed");
                        });
                    }
                });
            }

        });

        return item.ele;
    }

    var createMediaContentSummary = function(jid, id)
    {
        var media = {meetings:{rooms:[]}, recordings:{urls:[]}, photo:{urls:[]}, video:{urls:[]}, link:{urls:[]}, vmsg:{urls:[]}, ppt:{urls:[]}};

        console.debug("createMediaContentSummary", jid, id);

        _converse.api.archive.query({before: '', max: 9999999, 'groupchat': true, 'with': jid}, messages =>
        {
            //console.debug("createMediaContentSummary - query", messages);

            for (var i=0; i<messages.length; i++)
            {
                var body = messages[i].querySelector('body');
                var msgId = messages[i].querySelector('forwarded').querySelector('message').getAttribute('id');
                var from = messages[i].querySelector('forwarded').querySelector('message').getAttribute('from').split("/")[1];

                var timestamp = undefined;
                var delay = messages[i].querySelector('forwarded').querySelector('delay');
                if (delay) timestamp = delay.getAttribute('stamp');
                var stamp = moment(timestamp).format('MMM DD YYYY HH:mm:ss');

                console.debug("archived msg", i, from, body, msgId);

                if (body)
                {
                    var str = body.innerHTML;
                    var urls = str.match(/((http|https|ftp)?:\/\/[^\s]+)/g);

                    if (urls && urls.length > 0)
                    {
                        for (var j=0; j<urls.length; j++)
                        {
                            var pos = urls[j].lastIndexOf("/");
                            var file = urls[j].substring(pos + 1);

                            console.debug("media", i, j, from, file, urls[j]);

                            if (isAudioMeetingURL(urls[j]))
                            {
                                file = file.substring(file.indexOf(".") + 1);
                                media.recordings.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "audio"});
                            }
                            else

                            if (isVideoMeetingURL(urls[j]))
                            {
                                file = file.substring(file.indexOf(".") + 1);
                                media.recordings.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "video"});
                            }
                            else

                            if (isAudioURL(file))
                            {
                                media.vmsg.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "audio"});
                            }
                            else

                            if (isImageURL(file))
                            {
                                media.photo.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "image"});
                            }
                            else

                            if (isVideoURL(file))
                            {
                                media.video.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "video"});
                            }
                            else

                            if (isOnlyOfficeDoc(file))
                            {
                                media.ppt.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "doc"});
                            }
                            else

                            if (isH5p(urls[j]))
                            {
                                media.ppt.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: file, from: from, type: "h5p"});
                            }
                            else

                            if (isMeeting(urls[j]))
                            {
                                media.meetings.rooms.push({timestamp: stamp, id: msgId, url: urls[j], room: file, from: from, recordings: []});
                            }

                            else {
                                media.link.urls.push({timestamp: stamp, id: msgId, url: urls[j], file: urls[j], from: from, type: "link"});
                            }
                        }
                    }
                }
            }

            if (getSetting("postVideoRecordingUrl", false))
            {
                renderMeeting(id, media.meetings.rooms);

                for (var z=0; z<media.meetings.rooms.length; z++)
                {
                    renderMedia(id, media.meetings.rooms[z].room, media.recordings.urls, true);
                }
            }

            renderMedia(id, "vmsg", media.vmsg.urls);
            renderMedia(id, "photo", media.photo.urls);
            renderMedia(id, "video", media.video.urls);
            renderMedia(id, "ppt", media.ppt.urls);
            renderMedia(id, "link", media.link.urls);

            console.debug("media", media);
        });
    }

    var getHTML = function(id, jid)
    {
        console.debug("getHTML", jid, id);

        var html = '<h3>This Conversation</h3>' +
                   '<details>' +
                   '    <summary id="' + id + '-feed-details">Feeds (<span id="' + id + '-feed-count">0</span>)<span style="float: right;" class="far fa-newspaper"/></summary>' +
                   '</details>' +
                   '<details>' +
                   '    <summary id="' + id + '-pinned-details">Pinned Messages (<span id="' + id + '-pinned-count">0</span>)<span style="float: right;" class="fas fa-thumbtack"/></summary>' +
                   '</details>' +
                   '<h3 id="' + id + '-meeting-recordings">Meeting Recordings</h3>' +
                   '<h3>Media Content</h3>' +
                   '<details>' +
                   '    <summary id="' + id + '-photo-details">Photos (<span id="' + id + '-photo-count">0</span>)<span style="float: right;" class="fa fa-photo"/></summary>' +
                   '</details>' +
                   '<details>' +
                   '    <summary id="' + id + '-video-details">Videos (<span id="' + id + '-video-count">0</span>)<span style="float: right;" class="fa fa-video"/></summary>' +
                   '</details>' +
                   '<details>' +
                   '    <summary id="' + id + '-link-details">Shared Links (<span id="' + id + '-link-count">0</span>)<span style="float: right;" class="fas fa-link"/></summary>' +
                   '</details>' +
                   '<details>' +
                   '    <summary id="' + id + '-vmsg-details">Voice Messages (<span id="' + id + '-vmsg-count">0</span>)<span style="float: right;" class="fas fa-microphone"/></summary>' +
                   '</details>' +
                   '<details>' +
                   '    <summary id="' + id + '-ppt-details">Interactive Content (<span id="' + id + '-ppt-count">0</span>)<span style="float: right;" class="fa fa-file-powerpoint"/></summary>' +
                   '</details>';

        if (jid.startsWith("workgroup-"))
        {
            html += '<h3>This Workgroup</h3>' +
                    '<details>' +
                    '    <summary id="' + id + '-wg-queue-details">Queue (<span id="' + id + '-wg-queue-count">0</span>)<span style="float: right;" class="fas fa-info-circle"/></summary>' +
                    '</details>' +
                    '<details>' +
                    '    <summary id="' + id + '-wg-chats-details">Conversations (<span id="' + id + '-wg-chats-count">0</span>)<span style="float: right;" class="fa fa-user"/></summary>' +
                    '</details>' +
                    '<details>' +
                    '    <summary id="' + id + '-wg-others-details">Other Workgroups (<span id="' + id + '-wg-others-count">0</span>)<span style="float: right;" class="fas fa-users"/></summary>' +
                    '</details>';
        }

        if (bgWindow && (bgWindow.pade.activeH5p || bgWindow.pade.activeUrl))
        {
            html += '<h3>Collaborative Links</h3>' +
                    '<details>' +
                    '    <summary id="' + id + '-pdf-details">PDF Documents (<span id="' + id + '-pdf-count">0</span>)<span style="float: right;" class="fa fa-file"/></summary>' +
                    '</details>'+
                    '<details>' +
                    '    <summary id="' + id + '-apps-details">Applications (<span id="' + id + '-apps-count">0</span>)<span style="float: right;" class="fas fa-globe"/></summary>' +
                    '</details>';

            if (bgWindow.pade.activeH5p)
            {
                html += '<details>' +
                        '    <summary id="' + id + '-h5p-details">H5P Interactive Content (<span id="' + id + '-h5p-count">0</span>)<span style="float: right;" class="fa fa-h-square"/></summary>' +
                        '</details>';
            }
        }

        html += '<h3>Broadcasts</h3>' +
                '<details>' +
                '    <summary id="' + id + '-broadcast-details">Distribution Lists (<span id="' + id + '-broadcast-count">0</span>)<span style="float: right;" class="fas fa-bullhorn"/></summary>' +
                '</details>';

        return html;
    }

    var isH5PURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.indexOf("/h5p/") > -1
    };

    var isAudioMeetingURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.indexOf("/ofmeet-cdn/recordings/") > -1 && filename.endsWith(".audio.webm");
    };

    var isVideoMeetingURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.indexOf("/ofmeet-cdn/recordings/") > -1 && filename.endsWith(".video.webm");
    };

    var isMeeting = function (url)
    {
      const ofmeetUrl = getSetting("ofmeetUrl", null);
      const filename = url.toLowerCase();
      return ofmeetUrl && filename.indexOf(ofmeetUrl) > -1
    };

    var isPDFURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.endsWith('.pdf');
    };

    var isAudioURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.endsWith('.ogg') || filename.endsWith('.mp3') || filename.endsWith('.m4a');
    };

    var isImageURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.endsWith('.jpg') || filename.endsWith('.jpeg') || filename.endsWith('.png') || filename.endsWith('.gif') || filename.endsWith('.bmp') || filename.endsWith('.tiff') || filename.endsWith('.svg');
    };

    var isVideoURL = function (url)
    {
      const filename = url.toLowerCase();
      return filename.endsWith('.mp4') || filename.endsWith('.webm');
    };

    var isOnlyOfficeDoc = function (url)
    {
        var onlyOfficeDoc = false;
        var pos = url.lastIndexOf(".");

        if (pos > -1)
        {
            var exten = url.substring(pos + 1);
            onlyOfficeDoc = "doc docx ppt pptx xls xlsx csv pdf".indexOf(exten) > -1;
        }
        return onlyOfficeDoc;
    };

    var isH5p = function (url)
    {
        return url.indexOf("/h5p/") > -1;
    };

    var sortUrls = function (a,b)
    {
        if ( a.file < b.file )
            return -1;
        if ( a.file > b.file )
            return 1;
        return 0;
    };

    var newItemElement = function(el, item, className)
    {
        item.ele = document.createElement(el);
        item.ele.setAttribute('data-msgid', item.id);
        item.ele.setAttribute('data-url', item.url);
        item.ele.setAttribute('data-timestamp', item.timestamp);
        item.ele.setAttribute('data-type', item.type);
        item.ele.title = item.from + ' ' + item.timestamp + ': ' + item.file;
        item.ele.innerHTML = item.file || item.url;
        item.ele.classList.add(className);
        document.body.appendChild(item.ele);

        item.ele.addEventListener('click', function(evt)
        {
            evt.stopPropagation();

            const type = evt.target.getAttribute('data-type');
            const url = evt.target.getAttribute('data-url');
            const msgId = evt.target.getAttribute('data-msgid');

            console.debug("media item clicked", type, url, msgId);

            var elmnt = document.getElementById("msg-" + msgId);
            if (elmnt) elmnt.scrollIntoView({block: "end", inline: "nearest", behavior: "smooth"});

            if (type == "image" || type == "audio" || type == "video")
            {
                previewDialog = new PreviewDialog({'model': new converse.env.Backbone.Model({url: url, type: type}) });
                previewDialog.show();
            }
            else

            if (type == "link")
            {
                window.open(url, "pade-media-link");
            }
            else {  // insert into textarea
                replyInverseChat(url);
            }

        });

        return item.ele;
    }

    var renderMedia = function (id, eleName, urls, check)
    {
        urls.sort(sortUrls);

        var count = document.getElementById(id + "-" + eleName + "-count");
        var detail = document.getElementById(id + "-" + eleName + "-details");

        if (detail && count && urls.length > 0)
        {
            var total = 0;

            urls.forEach(function(element)
            {
                if (!check || (check && element.url.indexOf(eleName) > -1)) // find specific meeting div
                {
                    validateUrl(element, function(url)
                    {
                        if (url)
                        {
                            total++;
                            count.innerHTML = total;
                            detail.insertAdjacentElement('afterEnd', newItemElement('li', url, "mediaItem"));
                        }
                    });
                }
            });
        }
    }

    var validateUrl = function(url, callback)
    {
        console.debug("validateUrl check", url);

        fetch(url.url).then(function(response)
        {
            if (response.ok)
            {
                callback(url);
                console.debug("validateUrl check ok", url);
            } else {
                callback();
            }
        }).catch(function (err) {
            callback();
        });
    }

    var renderMeeting = function (id, meetings)
    {
        meetings.sort(sortUrls);
        var summary = document.getElementById(id + "-meeting-recordings");

        if (summary && meetings.length > 0)
        {
            for (var i=0; i<meetings.length; i++)
            {
                summary.insertAdjacentElement('afterEnd', newMeetingElement(id, meetings[i]));
            }
        }
    }

    var newMeetingElement = function(id, item)
    {
        item.ele = document.createElement("details");
        item.ele.title = item.url;
        item.ele.innerHTML = '<summary id="' + id + '-' + item.room + '-details">' + item.room + ' (<span id="' + id + '-' + item.room + '-count">0</span>)<span style="float: right;" class="fa fa-video fas fa-microphone"/></summary>';
        document.body.appendChild(item.ele);
        return item.ele;
    }

    var hideElement = function (el)
    {
        return addClass("hidden", el);
    }

    var addClass = function (className, el)
    {
      if (el instanceof Element)
      {
        el.classList.add(className);
      }
      return el;
    }

    var removeClass = function (className, el)
    {
      if (el instanceof Element)
      {
        el.classList.remove(className);
      }
      return el;
    }
}));
