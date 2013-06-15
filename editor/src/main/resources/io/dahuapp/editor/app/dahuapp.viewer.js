"use strict";

/**
 * Dahuapp viewer module.
 * 
 * @param   dahuapp     dahuapp object to augment with module.
 * @param   $           jQuery
 * @returns dahuapp extended with viewer module.
 */

var dahuapp = (function(dahuapp, $) {
    var viewer = (function() {

        var self = {};

        var DahuViewerModel = function(select) {

            /* Private API */

            var json = null;
            var selector = select;

            var events = (function() {
                var self = {};
                /*
                 * Creates a generic event.
                 */
                var createEvent = function() {
                    var callbacks = $.Callbacks();
                    return {
                        publish: callbacks.fire,
                        subscribe: callbacks.add,
                        unsubscribe: callbacks.remove
                    };
                };
                /*
                 * Called when the button next is pressed.
                 */
                self.onNext = createEvent();
                /*
                 * Called when the button previous is pressed.
                 */
                self.onPrevious = createEvent();
                /*
                 * Called when an action is over.
                 */
                self.onActionOver = createEvent();
                /*
                 * Called when an action starts.
                 */
                self.onActionStart = createEvent();
                return self;
            })();

            /*
             * Variables used like index for methodes subscribed.
             */
            var currentSlide = 0;
            var lastSlide = 0;
            var currentAction = 0;

            /*
             * Function used when an "onNextEvent" event is caught.
             */
            var onNextEventHandler = function() {
                while (json.data[currentSlide]) {
                    if (currentAction < 0) {
                        currentAction = 0;
                    }
                    while (json.data[currentSlide].action[currentAction]) {
                        if (json.data[currentSlide].action[currentAction].trigger === 'onClick') {
                            var mouseLocation = previousMouseLocation(currentSlide, currentAction);
                            $(selector + " ." + "mouse-cursor").animate({'top': mouseLocation.ord * 100 + "\%",
                                'left': mouseLocation.abs * 100 + "\%"}, 0);
                            launch(json.data[currentSlide].action[currentAction++]);
                            return;
                        }
                        currentAction++;
                    }
                    if (currentSlide < json.data.length - 1) {
                        lastSlide = currentSlide;
                        currentSlide++;
                        currentAction = 0;
                        actualise();
                    } else {
                        var mouseLocation = previousMouseLocation(currentSlide, currentAction);
                        $(selector + " ." + "mouse-cursor").animate({'top': mouseLocation.ord * 100 + "\%",
                            'left': mouseLocation.abs * 100 + "\%"}, 0);
                        return;
                    }
                }
            };

            /*
             * Function used when an "onPreviousEvent" event is caught.
             */
            var onPreviousEventHandler = function() {
                currentAction--;
                while (json.data[currentSlide]) {
                    while (json.data[currentSlide].action[currentAction]) {
                        if (json.data[currentSlide].action[currentAction].trigger === 'onClick') {
                            var mouseLocation = previousMouseLocation(currentSlide, currentAction);
                            $(selector + " ." + "mouse-cursor").animate({'top': mouseLocation.ord * 100 + "\%",
                                'left': mouseLocation.abs * 100 + "\%"}, 0);
                            return;
                        }
                        currentAction--;
                    }
                    if (currentSlide > 0) {
                        lastSlide = currentSlide;
                        currentSlide--;
                        actualise();
                        currentAction = json.data[currentSlide].indexAction - 1;
                    } else {
                        var mouseLocation = previousMouseLocation(currentSlide, currentAction);
                        $(selector + " ." + "mouse-cursor").animate({'top': mouseLocation.ord * 100 + "\%",
                            'left': mouseLocation.abs * 100 + "\%"}, 0);
                        return;
                    }
                }
            };

            /*
             * Function used when an "onActionOverEvent" event is caught.
             */
            var onActionOverEventHandler = function() {
                if (json.data[currentSlide].action[currentAction]) {
                    if (json.data[currentSlide].action[currentAction].trigger === 'afterPrevious') {
                        launch(json.data[currentSlide].action[currentAction++]);
                    }
                } else {
                    if (currentSlide < json.data.length - 1 && json.data[currentSlide + 1].action[0]) {
                        if (json.data[currentSlide + 1].action[0].trigger === 'afterPrevious') {
                            lastSlide = currentSlide;
                            currentSlide++;
                            actualise();
                            currentAction = 0;
                            launch(json.data[currentSlide].action[currentAction++]);
                        }
                    }
                }
            };

            /*
             * Function used when an "onActionStartEvent" event is caught.
             */
            var onActionStartEventHandler = function() {
                if (json.data[currentSlide].action[currentAction]) {
                    if (json.data[currentSlide].action[currentAction].trigger === 'withPrevious') {
                        launch(json.data[currentSlide].action[currentAction++]);
                    }
                } else {
                    if (currentSlide < json.data.length - 1 && json.data[currentSlide + 1].action[0]) {
                        if (json.data[currentSlide + 1].action[0].trigger === 'withPrevious') {
                            lastSlide = currentSlide;
                            currentSlide++;
                            currentAction = 0;
                            launch(json.data[currentSlide].action[currentAction++]);
                        }
                    }
                }
            };

            /*
             * Function used to actualise the background when there is a new slide.
             */
            var actualise = function() {
                $(selector + " ." + json.data[lastSlide].object[0].id).hide();
                $(selector + " ." + json.data[currentSlide].object[0].id).show();
            };

            /*
             * Function used to realise actions.
             */
            var launch = function(action) {
                var NextActionWithPrevious = hasNextActionWithPrevious(currentSlide, currentAction - 1);
                events.onActionStart.publish();
                var target = selector + ' .' + action.target;
                var animation = eval('(' + action.execute + ')');
                animation(target, action.finalAbs, action.finalOrd);
                if (!NextActionWithPrevious) {
                    events.onActionOver.publish();
                }
            };

            /*
             * Check the trigger of the next action.
             * @param int idSlide 
             * @param int idAction
             * @returns true if the next action's trigger is "withPrevious"
             */
            var hasNextActionWithPrevious = function(idSlide, idAction) {
                if (json.data[idSlide].action[idAction]) {
                    if (json.data[idSlide].action[idAction].trigger === 'withPrevious') {
                        return true;
                    }
                } else {
                    if (idSlide < json.data.length - 1) {
                        idSlide++;
                        idAction = 0;
                    }
                    if (json.data[idSlide].action[idAction]
                            && json.data[idSlide].action[idAction].trigger === 'withPrevious') {
                        return true;
                    }
                }
                return false;
            };

            /*
             * Looks for the previous mouse location.
             * @param int idSlide 
             * @param int idAction
             * @returns the mouse location before the current action.
             */
            var previousMouseLocation = function(idSlide, idAction) {
                var tempAction = 0;
                var mouseLocation = {};
                if (idAction === 0 && idSlide > 0) {
                    idSlide--;
                    idAction = json.data[idSlide].action.length;
                } else if (idAction === 0 && idSlide <= 0) {
                    mouseLocation.abs = json.data[0].action[0].finalAbs;
                    mouseLocation.ord = json.data[0].action[0].finalOrd;
                }
                while (tempAction < idAction) {
                    if (json.data[idSlide].action[tempAction].target === "mouse-cursor") {
                        mouseLocation.abs = json.data[idSlide].action[tempAction].finalAbs;
                        mouseLocation.ord = json.data[idSlide].action[tempAction].finalOrd;
                    }
                    tempAction++;
                }
                return mouseLocation;
            };



            /* Public API */

            this.load = function(url) {
                $.ajax({
                    'async': false,
                    'global': false,
                    'url': url,
                    'dataType': "json",
                    'success': function(data) {
                        json = data;
                    }
                });
            };

            this.start = function() {

                /*
                 * Subscription of methods to their events.
                 */
                events.onNext.subscribe(onNextEventHandler);
                events.onPrevious.subscribe(onPreviousEventHandler);
                events.onActionOver.subscribe(onActionOverEventHandler);
                events.onActionStart.subscribe(onActionStartEventHandler);
                /*
                 * Variable storing the total number of slides.
                 */
                var max = json.data.length;

                /*
                 *At the beginning, the visible image is the first one of the presentation
                 */
                for (var i = 0; i < max; i++) {
                    $(selector + " .s" + i + "-o0").hide();
                }
                $(selector + " ." + json.data[0].object[0].id).show();

                $(selector + " ." + "mouse-cursor").css({'top': json.data[0].action[0].finalOrd * 100 + "\%",
                    'left': json.data[0].action[0].finalAbs * 100 + "\%"});


                /*
                 * A click on the "next" button publishes a nextSlide event
                 */
                $(selector + " .next").click(function() {
                    events.onNext.publish();
                });
                /*
                 * A click on the "previous" button publishes a previousSlide event
                 */
                $(selector + " .previous").click(function() {
                    events.onPrevious.publish();
                });
            };
        };

        self.createDahuViewer = function(selector) {
            return new DahuViewerModel(selector);
        };

        return self;
    })();

    dahuapp.viewer = viewer;

    return dahuapp;

})(dahuapp || {}, jQuery);
