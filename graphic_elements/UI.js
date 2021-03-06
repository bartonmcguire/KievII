function UI(domElement, wrapperFactory, parameters) {

    // <EVENT HANDLING>

    // Thanks for these two functions to the noVNC project. You are great.
    // https://github.com/kanaka/noVNC/blob/master/include/util.js#L121
    
    // Get DOM element position on page
    this.getPosition = function (obj) {
        var x = 0, y = 0;
        if (obj.offsetParent) {
            do {
                x += obj.offsetLeft;
                y += obj.offsetTop;
                obj = obj.offsetParent;
            } while (obj);
        }
        return {'x': x, 'y': y};
    };

    // Get mouse event position in DOM element (don't know how to use scale yet).
    this.getEventPosition = function (e, obj, scale) {
        var evt, docX, docY, pos;
        //if (!e) evt = window.event;
        evt = (e ? e : window.event);
        if (evt.pageX || evt.pageY) {
            docX = evt.pageX;
            docY = evt.pageY;
        } else if (evt.clientX || evt.clientY) {
            docX = evt.clientX + document.body.scrollLeft +
                document.documentElement.scrollLeft;
            docY = evt.clientY + document.body.scrollTop +
                document.documentElement.scrollTop;
        }
        pos = this.getPosition(obj);
        if (typeof scale === "undefined") {
            scale = 1;
        }
        return {'x': (docX - pos.x) / scale, 'y': (docY - pos.y) / scale};
    };

    // Event handlers: we need closures here, because they will be called as callbacks.

    // On mouseMove event
    this.onMouseMoveFunc = function () {
        var that = this;
            return function (evt) {

            //var realCoords = that.calculateOffset(evt);
            var realCoords = that.getEventPosition (evt, that.domElement);

            // Only if the mouse button is still down (This could be useless TODO).
            if (that.mouseUp === false) {
                that.elementsNotifyEvent(realCoords.x, realCoords.y, "onMouseMove");
            }
        };
    };

    // On mouseDown event
    this.onMouseDownFunc = function () {
        var that = this;
            return function (evt) {

            var realCoords = that.getEventPosition (evt, that.domElement);

            that.mouseUp = false;
            that.elementsNotifyEvent(realCoords.x, realCoords.y, "onMouseDown");
        };
    };

    // On mouseUp event
    this.onMouseUpFunc = function () {
        var that = this;
            return function (evt) {

            var realCoords = that.getEventPosition (evt, that.domElement);

            that.mouseUp = true;
            that.elementsNotifyEvent(realCoords.x, realCoords.y, "onMouseUp");

        };
    };

    // Note: breakOnFirstEvent works only elements that share the same kind of
    // event handling mechanism (es: buttons with buttons).
    // Notify every element about the event.
    this.elementsNotifyEvent = function (x, y, event) {
        
        // For every element in Z-index array, in order
        for (var z = this.zMax; z >= this.zMin; z -= 1) {
            // The array has holes.
            if (this.zArray[z] !== undefined) {
                for (var k = (this.zArray[z].length -1); k >=0; k -= 1) {
                    // If the element wants to be bothered with events
                    if (this.zArray[z][k].getClickable()) {
                        // Notify the element
                        ret = this.zArray[z][k][event](x, y);
                        // See if the element changed its value
                        if (ret !== undefined) {
                            if (ret instanceof Array) {
                                // An element could change multiple slots of itself.
                                for (var i = 0; i < ret.length; i+=1) {
                                    this.setValue({elementID: this.zArray[z][k].ID, slot: ret[i].slot, value: ret[i].value});
                                }
                            }
                            else {
                                // console.log("UI: Element ", ID, " changed its value on event ", event);
                                this.setValue({elementID: this.zArray[z][k].ID, slot: ret.slot, value: ret.value});
                            }

                            if (this.breakOnFirstEvent === true) {
                                // One element has answered to an event, return.
                                return;
                            }
                        }
                    }
                }
            }
        }
        
    };

    // <END OF EVENT HANDLING>


    // <CONSTRUCTOR>
    this.domElement = domElement;

    this.domElement.addEventListener("mousedown", this.onMouseDownFunc(), true);
    this.domElement.addEventListener("mouseup", this.onMouseUpFunc(), true);
    this.domElement.addEventListener("mousemove", this.onMouseMoveFunc(), true);

    this.mouseUp = true;
   
    var ret;

    // Elements in this UI.
    this.elements = {};

    // Connection between elements
    this.connections = {};

    // Z-index lists.
    this.zArray = [];

    // Graphic frontend wrapper
    this.graphicWrapper = wrapperFactory;

    // Break on first
    if (parameters !== undefined) {
        this.breakOnFirstEvent = parameters.breakOnFirstEvent || false;
    }

    // </CONSTRUCTOR>

    // <ELEMENT HANDLING>

    // *** Add an UI element **** //
    this.addElement = function (element, elementParameters) {
        var slot,
            slots;

        if (this.elements[element.ID] !== undefined) {
            throw new Error("Conflicting / Duplicated ID in UI: " + element.ID + " (IDs are identifiers and should be unique)");
            return;
        }

        this.elements[element.ID] = element;

        // Set the element's graphic wrapper
        element.setGraphicWrapper(this.graphicWrapper);

        // Insert the element in the connection keys.
        this.connections[element.ID] = {};

        // Get the slots available from the element.
        slots = element.getValues();

        // Insert all possible elements in the connection matrix TODO ARRAY
        for (slot in slots) {
            if (slots.hasOwnProperty(slot)) {
                this.connections[element.ID][slots[slot]] = [];
            }
        }

        // Store the parameters
        var zIndex = 0;
        
        if ((typeof(elementParameters) !== "undefined") && (typeof(elementParameters.zIndex) !== "undefined")) {
            zIndex = elementParameters.zIndex;
        }
        
        if ((zIndex < 0) || (typeof(zIndex) !== "number")) {
                throw new Error("zIndex " + zIndex + " invalid");
            }
            
        // Insert the z-index into the element
        // Do we ever use this? TODO
        this.elements[element.ID].zIndex = zIndex;
        
        // if it's the first of its kind, initialize the array.
        if (this.zArray[zIndex] === undefined) {
            this.zArray[zIndex] = [];
        }
        // Update the maximum and minimum z index.
        this.zArray[zIndex].push(this.elements[element.ID]);
        if ((this.zMin === undefined) || (this.zMin > zIndex)) {
            this.zMin = zIndex;
        }
        if ((this.zMax === undefined) || (this.zMax <  zIndex)) {
            this.zMax = zIndex;
        }
        
    };
    
    // </ELEMENT HANDLING>


    // <CONNECTION HANDLING>

    // Connect slots, so that one element can "listen" to the other
    this.connectSlots  = function (senderElement, senderSlot, receiverElement, receiverSlot, connectParameters) {

        //Check for the elements.
        if ((this.elements[senderElement] !== undefined) && (this.elements[receiverElement] !== undefined)) {
            // //Check for the slots.
            if ((this.elements[senderElement].values[senderSlot] === undefined) ||
                (this.elements[receiverElement].values[receiverSlot] === undefined))  {
                throw new Error("Slot " + senderSlot + " or " + receiverSlot + " not present.");
            }

            else {

                //The sender & receiver element & slot exist. Do the connection.
                var receiverHash = {"recvElement" : receiverElement, "recvSlot": receiverSlot};

                //Check if there are optional parameters
                if (connectParameters !== undefined) {
                    // Is there a callback?
                    if (typeof(connectParameters.callback) === "function") {
                        receiverHash.callback = connectParameters.callback;
                    }
                    // Should the connection setValue fire cascading setValue callbacks?
                    // By default, yes.
                    receiverHash.cascade = true;
                    if (connectParameters.cascade !== undefined) {
                        receiverHash.cascade = connectParameters.cascade;
                    }
                }

                // Push the destination element/slot in the connections matrix.
                this.connections[senderElement][senderSlot].push(receiverHash);
            }
            
        }
        else {
            throw new Error("Element " + senderElement + " or " + receiverElement + " not present.");
        }
    };

    //</CONNECTION HANDLING>


    // <VALUE HANDLING>

    // This method handles one set value event and propagates it in the connections matrix
    //this.setValue ({slot: sl, value: val, elementID: id, fireCallback:false, history:undefined});
    this.setValue = function (setParms) {
        var hist = [],
            receiverHash,
            recvElementID,
            recvSlot,
            i,
            RECURSIONMAX = 1000,
            elementID,
            value,
            slot,
            fireCallback,
            history;
        
        // Default parameters
        if (typeof (setParms.elementID) === 'undefined') {
            throw ("ID is undefined");
        }
        else elementID = setParms.elementID;
        
        if (typeof (setParms.value) === 'undefined') {
            throw ("value is undefined");
        }
        else value = setParms.value;
        
        if (typeof (setParms.fireCallback) === 'undefined') {
            fireCallback = true;
        }
        else fireCallback = setParms.fireCallback;
        
        history = setParms.history;
        // End of defaults
        
        if (this.elements[elementID] !== undefined) {
            
            // Get the default slot here, if no one specified a slot
            if (typeof (setParms.slot) === 'undefined') {
                slot = this.elements[elementID].defaultSlot;
                if (typeof(slot) === undefined) {
                    throw "Default slot is undefined!";
                }
            }
            else slot = setParms.slot;

            // First of all, check history if it is present.
            if (history !== undefined) {
                hist = history;
                // Is this an infinite loop?
                for(var k = 0; k < hist.length ; k += 1) {
                    // This is for precaution.
                    if (hist.length > RECURSIONMAX) {
                        throw new Error ("Recursion exceeded");
                        return;
                    }
                    if ((hist[k]["element"] === elementID) && (hist[k]["slot"] === slot)) {
                        // Loop is infinite; bail out!
                        // console.log ("Broke recursion!");
                        return;
                    }
                }
            }
            // Element is present an there's no need to break a loop
            // really set value.
            this.elements[elementID].setValue(slot, value);
            
            // Finally, call the callback if there is one and we're allowed to.
            if ((typeof (this.elements[elementID].onValueSet) === "function") && (fireCallback !== false)) {
                this.elements[elementID].onValueSet (slot, this.elements[elementID].values[slot], this.elements[elementID].ID);
            }

            // This element has been already set: update history
            hist.push({"element" : elementID, "slot" : slot});
        }

        else {
            throw new Error("Element " + elementID + " not present.");
        }

        // Check if this element has connections
        if (this.connections[elementID][slot] !== undefined) {

            // For every connection the element has
            for (i in this.connections[elementID][slot]) {

                if (this.connections[elementID][slot].hasOwnProperty(i)){

                    // Retrieve the other connection end and the connection parameters.
                    receiverHash = this.connections[elementID][slot][i];
                 
                    recvElementID = receiverHash.recvElement;
                    recvSlot = receiverHash.recvSlot;

                    // Check the callback here.
                    if (typeof(receiverHash.callback) === "function") {
                        // We have a callback to call.
                        value = receiverHash.callback (value);
                    }

                    // Check if consequent setValue()s should have cascading
                    // consequences (i.e. fire the callbacks)
                    var fire_conn_callback;
                    if (receiverHash.cascade === false) {
                        fire_conn_callback = false;
                    }
                    else {
                        fire_conn_callback = true;
                    }

                    // Recursively calls itself, keeping an history in the stack
                    this.setValue({elementID: recvElementID, slot: recvSlot, value: value, history: hist, fireCallback: fire_conn_callback});
                }
            }
        }
    };
    // </VALUE HANDLING>

    // <VISIBILITY, RECEIVING EVENTS>

    // These two functions are complementary.

    this.hideElement = function (elementID) {

        var visibilityState;

        if (this.elements[elementID] !== undefined) {
            visibilityState = this.elements[elementID].getVisible();
            if (visibilityState === true) {
                // Set the element's visibility
                this.elements[elementID].setVisible (false);
                // When hidden, the element is also not listening to events
                this.elements[elementID].setClickable (false);

            }

        }

        else {
            throw new Error("Element " + elementID + " not present.");
        }

    }

    this.unhideElement = function (elementID) {

        var visibilityState;

        if (this.elements[elementID] !== undefined) {
            visibilityState = this.elements[elementID].getVisible();
            if (visibilityState === false) {

                // Set the element's visibility
                this.elements[elementID].setVisible (true);
                // When unhidden, the element starts listening to events again.
                this.elements[elementID].setClickable (true);

            }

        }

        else {
            throw new Error("Element " + elementID + " not present.");
        }
    }

    this.setHidden = function (elementID, value) {
        this.setVisible(elementID, !value)
    }

    this.setVisible = function (elementID, value) {
        var visibilityState;

        if (this.elements[elementID] !== undefined) {
            visibilityState = this.elements[elementID].getVisible();
            if (visibilityState !== value) {

                // Set the element's visibility
                this.elements[elementID].setVisible (value);
                // When unhidden, the element starts listening to events again.
                this.elements[elementID].setClickable (value);

            }

        }

        else {
            throw new Error("Element " + elementID + " not present.");
        }
    }
    
    this.setClickable = function (elementID, value) {
            var state;

            if (this.elements[elementID] !== undefined) {
                state = this.elements[elementID].getClickable();
                if (state !== value) {

                    // When unhidden, the element starts listening to events again.
                    this.elements[elementID].setClickable (value);

                }

            }

            else {
                throw new Error("Element " + elementID + " not present.");
            }
        }

    // </VISIBILITY, RECEIVING EVENTS>
   

    // <REFRESH HANDLING>
    this.refreshZ = function (z) {
        //Refresh every layer, starting from z to the last one.
        for (var i = z, length =  this.zArray.length; i < length; i += 1) {
            if (typeof(this.zArray[i]) === "object") {
                for (var k = 0, z_length = this.zArray[i].length; k < z_length; k += 1) {
                    if (this.zArray[i][k].getVisible() === true) {
                        this.zArray[i][k].refresh();
                    }
                }
            }
        }
    }

    this.refresh = function (doReset) {
        // Reset everything
        if (doReset !== false) {
            this.reset();
        }
        
        // Then refresh everything from the smallest z-value, if there is one.
        if (this.zMin !== undefined) {
            this.refreshZ(this.zMin);
        }
    }

    this.reset = function () {
        // Reset the graphic frontend
        this.graphicWrapper.reset();
    }
}
    // </REFRESH HANDLING>
