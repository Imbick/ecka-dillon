var updatesQueue = [];

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

            break;
        case "UL":
            updateVerticalUL(element, update);
            break;
    }
}

function updateVerticalUL(ul, update) {
    ul = $(ul);
    var height = ul.outerHeight();
    var percent = Math.floor((update.y / height) * 100);
    var tenth = Math.ceil(percent / 10);

    var items = ul.children("li");

    for (var i = 0; i < 10; ++i) {
        $(items[i]).removeClass("disabled");
    }

    for (var j = 0; j < 10 - tenth; ++j) {
        $(items[j]).addClass("disabled");
    }

    var id = ul.data("id");
    $("h1[data-id='" + id + "'").text(percent);
}

function enqueueUpdate(update) {
    var lastUpdate = updatesQueue[updatesQueue.length - 1];
    if (lastUpdate && lastUpdate.id === update.id && lastUpdate.x === update.x && lastUpdate.y === update.y) {
        console.warn("skipping update due to duplication. Id: " + update.id + " " + update.x + "," + update.y + " queue length: " + updatesQueue.length);
        return;
    }

    console.log("Queued id: " + update.id + " x: " + update.x + " y: " + update.y);
    updatesQueue.push(update);
}

function flushUpdatesQueue(queue) {
    if (queue.length <= 0)
        return;

    console.groupCollapsed("Flushing queue");

    var MAX_QUEUE_LENGTH = 20;
    var batchSize = queue.length;
    if (batchSize > MAX_QUEUE_LENGTH)
        console.warn("queue length == " + batchSize + ", should be less than " + MAX_QUEUE_LENGTH);

    var updates = "";
    for (var i = 0; i < batchSize; ++i) {
        var item = "updates[" + i + "]";
        updates += item + ".id=" + queue[i].id + "&" +
                   item + ".x=" + queue[i].x + "&" +
                   item + ".y=" + queue[i].y + "&" +
                   item + ".normalisedX=" + queue[i].normalisedX + "&" + 
                   item + ".normalisedY=" + queue[i].normalisedY + "&";
    }
    queue.splice(0, batchSize); //new updates could have been added so only remove the batch we just processed
    updates = updates.slice(0, -1);
    var url = "/update?" + updates; //todo increment and send batch id
    console.log("Submitting " + batchSize + " updates to " + url);

    $.ajax({
        method: "GET",
        url: url,
        async: false, //because this code isn't run on the UI thread (setInterval) it's ok to wait
        cache: false //don't let the browser fake the response
    })
    .done(function (response) {
        console.log("Submission done for " + response + " updates."); //todo use promises here to queue up next batch rather than a timer
    })
    .fail(function (msg) {
        console.error(msg);
    });
    console.groupEnd();
}

function respondToEvent(element, x, y) {
    var update = calculateUpdate(element, x, y);
    update.id = $(element).data("id");
    enqueueUpdate(update);
    updateElement(element, update);

    return update;
}

var ongoingTouches = [];

function initEvents() {
    var dualAxis = document.getElementsByClassName('dual-axis');
    for (var i = 0; i < dualAxis.length; ++i) {
        dualAxis[i].addEventListener("touchstart", handleStart, false);
        dualAxis[i].addEventListener("touchmove", handleMove, false);
        dualAxis[i].addEventListener("touchcancel", handleCancel, false);
        dualAxis[i].addEventListener("touchend", handleEnd, false);
        
        dualAxis[i].addEventListener("mousedown", handleMouseDown, false);
        dualAxis[i].addEventListener("mousemove", handleMouseMove, false);
    }

    var uls = document.getElementsByTagName("ul");
    for (var k = 0; k < uls.length; ++k) {
        uls[k].addEventListener("touchmove", handleMove, false);
        uls[k].addEventListener("touchcancel", handleCancel, false);
        uls[k].addEventListener("touchend", handleEnd, false);
        uls[k].addEventListener("touchstart", handleStart, false);

        uls[k].addEventListener("mousedown", handleMouseDown, false);
        uls[k].addEventListener("mousemove", handleMouseMove, false);
    }

    var buttons = document.getElementsByTagName("button");
    for (var j = 0; j < buttons.length; ++j) {
        buttons[j].addEventListener("touchstart", handleStart, false);
        buttons[j].addEventListener("mousedown", handleMouseDown, false);
    }

    document.getElementsByTagName("body")[0].addEventListener("mouseup", handleMouseUp, false);
    document.addEventListener("mouseout", handleMouseOut, false);
}

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

var down = false;

function handleMouseDown(e) {
    e = e ? e : window.event;
    console.groupCollapsed("mousedown on element " + this + " with id: " + $(this).data("id"));
    down = true;
    respondToEvent(this, e.pageX, e.pageY);
}

function handleMouseMove(e) {
    e = e ? e : window.event;
    if (!down) return;
    respondToEvent(this, e.pageX, e.pageY);
}

function handleMouseUp(e) {
    e = e ? e : window.event;
    if (down) {
        console.log("mouse up on " + this);
        console.groupEnd();
    }
    down = false;
}

function handleMouseOut(e) {
    e = e ? e : window.event;
    var from = e.relatedTarget || e.toElement;
    if (down && (!from || from.nodeName === "Window")) {
        down = false;
        console.log("mouse out on " + this);
        console.groupEnd();
    }
}

function printDiagnostics() {
    console.log("    _____  _ _ _             ");
    console.log("   |  __ \\(_) | |            ");
    console.log("   | |  | |_| | | ___  _ __  ");
    console.log("   | |  | | | | |/ _ \\| '_ \\ ");
    console.log("   | |__| | | | | (_) | | | |");
    console.log("   |_____/|_|_|_|\\___/|_| |_|");
    console.log("---------------------------------");
    console.log(navigator.appVersion);
}

$(document).ready(function () {
    printDiagnostics();

    updateVerticalUL($('ul'), { y: 0 });
    initEvents();

    var queueTimer = setInterval(flushUpdatesQueue, 100, updatesQueue);
});

function copyTouch(touch) {
    return { identifier: touch.identifier, pageX: touch.pageX, pageY: touch.pageY };
}

function ongoingTouchIndexById(idToFind) {
    for (var i = 0; i < ongoingTouches.length; i++) {
        var id = ongoingTouches[i].identifier;

        if (id === idToFind)
            return i;
    }
    return -1;    // not found
}

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
}