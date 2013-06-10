"use strict";

/**
 * Dahuapp editor module.
 * 
 * @param   dahuapp     dahuapp object to augment with module.
 * @param   $           jQuery
 * @returns dahuapp extended with editor module.
 */
var dahuapp = (function(dahuapp, $) {
    var editor = (function() {

        var self = {};

        /* private API */

        /*
         * Tells if the app is in the capture mode (in theory, no actions are
         * available in this mode, other than clicking on the capture mode
         * button, or pressing the capture or escape keyboard keys).
         * @type Boolean
         */
        var captureMode = false;

        /*
         * Name of the Json file.
         * @type String
         */
        var jsonFileName = "presentation.dahu";

        /*
         * True when new button was pressed.
         * @type Boolean
         */
        var initProject = false;

        /*
         * The absolute path of a directory.
         * This directory has the following components (at least) :
         * projectDir
         *      |------- format.json
         *      |------- screen1.png
         *      |------- ...
         *      |------- screen2.png
         *      
         * The default value must be discussed.
         * @type String
         */
        var projectDir = ".";
        
        /*
         * Current slide displayed in the view.
         * @type String
         */
        var currentSlide = null;
        
        /*
         * Private events for the editor.
         */
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
             * Called when an image on the list has been selected and
             * is different from the previous one.
             */
            self.selectedImageChanged = createEvent();
            
            /*
             * Called when an image is added (by taking a screen capture).
             */
            self.newImageTaken = createEvent();
            
            return self;
        })();

        /*
         * Changes the capture mode (if true => false, if false => true).
         */
        var switchCaptureMode = function() {
            // shortcut
            var keyboardDriver = dahuapp.drivers.keyboard;
            // if we're in capture mode, we exit it, otherwise we enter it
            if (!captureMode) {
                keyboardDriver.addKeyListener(self.handleCaptureModeEvent);
            } else {
                keyboardDriver.removeKeyListener(self.handleCaptureModeEvent);
            }
            // the capture mode button gets a different style
            $('#capture-mode').toggleClass('btn-primary');
            $('#capture-mode').toggleClass('btn-success');
            captureMode = !captureMode;
            if (captureMode) {
                dahuapp.drivers.logger.JSconfig("dahuap.editor.js", "switchCaptureMode", "capture mode on");
            } else {
                dahuapp.drivers.logger.JSconfig("dahuap.editor.js", "switchCaptureMode", "capture mode off");
            }
        };
        
        /*
         * Function to update the preview on the middle.
         */
        var updatePreview = function(slide) {
            $('#preview-image').replaceWith($(document.createElement('div'))
                    .attr({'id':'preview-image'})
                    .append($(document.createElement('img'))
                            .attr({'src': slide, 'alt': slide})
                    )
            );
        };
        
        /*
         * Function to update the image list (when a new one is captured).
         */
        var updateImageList = function(img) {
            $('#image-list').append($(document.createElement('li'))
                    .attr({'class': 'span2 offset'})
                    .append($(document.createElement('a'))
                            .attr({'class': 'thumbnail'})
                            .append($(document.createElement('img'))
                                    .attr({'src': img, 'alt': img})
                            )
                    )
            );
        };

        /* public API */

        /*
         * Event handlers
         ****************
         * For each handler, put a function name (the same as the key for example).
         * Anonymous functions can't be called from the driver,
         * because Java7 doesn't handle JSObjects well, so it only records the name.
         */

        /*
         * Handle events relative to the capture mode.
         * Other events will be ignored.
         * 
         * Can be eventually set private if JSObject can be memorized by java.
         * 
         * @param int key Key that caused the event.
         */
        self.handleCaptureModeEvent = function handleCaptureModeEvent(key) {
            // shortcuts
            var drivers = dahuapp.drivers;
            var sep = drivers.fileSystem.getSeparator();
            switch (drivers.keyboard.keyToString(key).toLowerCase()) {
                case "f7":
                    var img = dahuapp.drivers.screen.takeScreen(projectDir);
                    var mouse = dahuapp.drivers.mouse;
                    dahuapp.json.addSlide(img, mouse.getMouseX(), mouse.getMouseY());
                    events.newImageTaken.publish(projectDir + sep + img);
                    break;
                case "escape":
                    switchCaptureMode();
                    break;
            }
        };
        
        /*
         * Main function : by calling this function, we bind the
         * html components of the application with their behaviour.
         * So this function must be called once when the html is loaded
         * in the application window.
         */
        self.init = function init() {
            
            /*
             * Private events callbacks subscribals.
             */
            events.selectedImageChanged.subscribe(updatePreview);
            events.newImageTaken.subscribe(updateImageList);
            
            /*
             * Basic events for the buttons and components.
             */
            $('#image-list').on('click', 'img', function() {
                var imgName = $(this).attr('src');
                if (currentSlide !== imgName) {
                    currentSlide = imgName;
                    events.selectedImageChanged.publish(currentSlide);
                }
            });
            $('#capture-mode').click(function() {
                if (initProject) {
                    switchCaptureMode();
                }
            });
            $('#save-project').click(function() {
                if (initProject && !captureMode) {
                    var stringJson = dahuapp.json.getJson();
                    var driver = dahuapp.drivers.fileSystem;
                    if (driver.writeFile(projectDir + driver.getSeparator() + jsonFileName, stringJson)) {
                        dahuapp.drivers.logger.JSinfo("dahuapp.editor.js", "init", "project saved in " + projectDir);
                        alert("The project was successfully saved");
                    } else {
                        dahuapp.drivers.logger.JSsevere("dahuapp.editor.js", "init", "failed to save project in " + projectDir);
                    }
                } else if (captureMode) {
                    dahuapp.drivers.logger.JSwarning("dahuapp.editor.js", "init", "can't save a project when captureMode is on!");
                } else {
                    dahuapp.drivers.logger.JSwarning("dahuapp.editor.js", "init", "can't save as there is no project selected !");
                }
            });
            $('#open-project').click(function() {
                if (!captureMode) {
                    var driver = dahuapp.drivers.fileSystem;
                    projectDir = prompt("Enter the absolute path to the dahu project file :",
                            "Dahu project file.");
                    // projectDir = driver.askForProjectDir();
                    if (projectDir) {
                        var stringJson = driver.readFile(projectDir + driver.getSeparator() + jsonFileName);
                        var slideList;
                        var i = 0;
                        dahuapp.json.loadJson(stringJson);
                        slideList = dahuapp.json.getSlideList();
                        while (slideList[i]) {
                            var img = slideList[i];
                            events.newImageTaken.publish(img);
                            i++;
                        }

                        initProject = true;
                    }
                } else {
                    dahuapp.drivers.logger.JSwarning("dahuapp.editor.js", "init", "can't open a project when captureMode is on!");
                }
            });
            $('#new-project').click(function() {
                if (!captureMode) {
                    projectDir = prompt("Enter the absolute path of the project directory :",
                            "Dahu project directory.");
                    dahuapp.json.createPresentation();
                    alert("The project was successfully created.");
                    dahuapp.drivers.logger.JSinfo("dahuapp.editor.js", "init", "project created !");
                    initProject = true;
                } else {
                    dahuapp.drivers.logger.JSwarning("dahuapp.editor.js", "init", "can't create a new project when captureMode is on!");
                }
            });
            $('#exit').click(function() {
                if (confirm('are you sure you want to quit ?')) {
                    dahuapp.drivers.logger.JSlog("dahuapp.editor.js", "init", "quit confirm ok");
                } else {
                    dahuapp.drivers.logger.JSlog("dahuapp.editor.js", "init", "quit confirm not ok");
                }
            });
        };

        /**
         * 
         * @param {type} args
         * @returns {String}
         */
        self.somePublicFunction = function somePublicFunction(args) {
            return "public (editor) hello " + args;
        };

        return self;
    })();

    dahuapp.editor = editor;

    return dahuapp;
})(dahuapp || {}, jQuery);