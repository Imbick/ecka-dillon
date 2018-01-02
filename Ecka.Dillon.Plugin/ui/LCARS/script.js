function calculateUpdate(element, pageX, pageY) {
    //todo check class for orientation, assume vertical for now
    element = $(element);

    var update = {};
    var height = element.outerHeight();
    update.y = height - (pageY - element.offset().top);
    update.y = update.y.clamp(0, height);

    var width = element.outerWidth();
    update.x = pageX - element.offset().left;
    update.x = update.x.clamp(0, width);

    update.normalisedX = update.x / width;
    update.normalisedY = update.y / height;

    return update;
}

function updateElement(element, update) {
    //todo check element type and class for orientation, assume vertical UL for now
    switch (element.tagName) {
        case "BUTTON":
            updateDescreteRange(element, update);
            break;
        case "UL":
            updateVerticalUL(element, update);
            break;
    }
}

function updateDescreteRange(element, update) {
    element = $(element);
    var isUp = element.text() === "+";
    var div = element.parent();
    var children = div.children();
    var val = parseInt(children[2].innerText);
    if (isUp)
        $(children[2]).text(val + 1);
    else
        $(children[2]).text(val - 1);
}

function updateVerticalUL(ul, update) {
    ul = $(ul);
    var height = ul.outerHeight();
    var percent = Math.floor((update.y / height) * 100);

    var marker = ul.children(".range-marker");
    if (marker.length <= 0) {
        marker = $("<div></div>");
        marker.addClass("range-marker");
        ul.append(marker);
    }
    var top = ul.offset().top;
    var y = (top + height) - (update.y + 23);
    marker.css("top", y.clamp(top, top + height - 46));
    marker.css("left", ul.offset().left);
    marker.text(percent.pad(3));
}

function respondToEvent(element, x, y) {
    var update = calculateUpdate(element, x, y);
    //update.id = $(element).data("id");
    //enqueueUpdate(update);
    updateElement(element, update);

    return update;
}

var ongoingTouches = [];

function handleStart(e) {
    e = e ? e : window.event;
    console.groupCollapsed("touch event");
    e.preventDefault();
    var touches = e.changedTouches;

    for (var i = 0; i < touches.length; i++) {
        ongoingTouches.push(copyTouch(touches[i]));
        respondToEvent(this, touches[i].pageX, touches[i].pageY);
    }
}

function handleMove(e) {
    e = e ? e : window.event;
    e.preventDefault();
    var touches = e.changedTouches;

    for (var i = 0; i < touches.length; i++) {
        var idx = ongoingTouchIndexById(touches[i].identifier);

        if (idx < 0) {
            console.error("Couldn't find touch with identifier " + touches[i].identifier);
            return;
        }

        respondToEvent(this, touches[i].pageX, touches[i].pageY);

        ongoingTouches.splice(idx, 1, copyTouch(touches[i]));  // swap in the new touch record
    }
}

function handleCancel(e) {
    e = e ? e : window.event;
    e.preventDefault();
    var touches = e.changedTouches;

    for (var i = 0; i < touches.length; i++) {
        var idx = ongoingTouchIndexById(touches[i].identifier);
        ongoingTouches.splice(idx, 1);  // remove it; we're done
    }
}

function handleEnd(e) {
    e = e ? e : window.event;
    e.preventDefault();
    var touches = e.changedTouches;

    for (var i = 0; i < touches.length; i++) {
        var idx = ongoingTouchIndexById(touches[i].identifier);

        if (idx < 0) {
            console.error("Couldn't find touch with identifier " + touches[i].identifier);
            return;
        }

        respondToEvent(this, touches[i].pageX, touches[i].pageY);

        ongoingTouches.splice(idx, 1); // remove it; we're done
    }
    //todo add code to reset batch counter (also add to mouse equivalent)
    console.log("touch ended");
    console.groupEnd();
}

var isDown = false;

function handleMouseDown(e) {
    e = e ? e : window.event;
    console.groupCollapsed("mousedown on element " + this + " with id: " + $(this).data("id"));
    isDown = true;
    respondToEvent(this, e.pageX, e.pageY);
}

function handleMouseMove(e) {
    e = e ? e : window.event;
    if (!isDown) return;
    respondToEvent(this, e.pageX, e.pageY);
}

function handleMouseUp(e) {
    e = e ? e : window.event;
    if (isDown) {
        console.log("mouse up on " + this);
        console.groupEnd();
    }
    isDown = false;
}

function handleMouseOut(e) {
    e = e ? e : window.event;
    var from = e.relatedTarget || e.toElement;
    if (isDown && (!from || from.nodeName == "Window")) {
        isDown = false;
        console.log("mouse out on " + this);
        console.groupEnd();
    }
}

function initEvents() {

    var uls = document.getElementsByTagName("ul");
    for (var i = 0; i < uls.length; ++i) {
        uls[i].addEventListener("touchstart", handleStart, false);
        uls[i].addEventListener("touchmove", handleMove, false);
        uls[i].addEventListener("touchcancel", handleCancel, false);
        uls[i].addEventListener("touchend", handleEnd, false);

        uls[i].addEventListener("mousedown", handleMouseDown, false);
        uls[i].addEventListener("mousemove", handleMouseMove, false);
    }

    var buttons = document.getElementsByTagName("button");
    for (var i = 0; i < buttons.length; ++i) {
        buttons[i].addEventListener("touchstart", handleStart, false);
        buttons[i].addEventListener("touchmove", handleMove, false);
        buttons[i].addEventListener("touchcancel", handleCancel, false);
        buttons[i].addEventListener("touchend", handleEnd, false);

        buttons[i].addEventListener("mousedown", handleMouseDown, false);
        buttons[i].addEventListener("mousemove", handleMouseMove, false);
    }

    document.addEventListener("mouseup", handleMouseUp, false);
    //window.addEventListener("mouseout", handleMouseOut, false);
}

$(document).ready(function () {
    initEvents();
    var uls = document.getElementsByTagName("ul");
    for (var i = 0; i < uls.length; ++i) {
        updateVerticalUL(uls[i], { y: 0 });
    }
});

function copyTouch(touch) {
    return { identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY };
}

function ongoingTouchIndexById(idToFind) {
    for (var i = 0; i < ongoingTouches.length; i++) {
        var id = ongoingTouches[i].identifier;

        if (id == idToFind)
            return i;
    }
    return -1;    // not found
}

Number.prototype.clamp = function (min, max) {
    return Math.min(Math.max(this, min), max);
}

Number.prototype.pad = function pad(size) {
    var s = this + "";
    while (s.length < size) s = "0" + s;
    return s;
}