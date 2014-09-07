/*
 * Mentions Input
 * Written by: Kenneth Auchenberg (Podio)
 * Forked and extended by: Christopher Blum (Protonet)
 *
 * Using underscore.js
 *
 * License: MIT License - http://www.opensource.org/licenses/mit-license.php
 */

(function ($, _, undefined) {

  // Settings
  var $window = $(window);
  var KEY = { BACKSPACE : 8, TAB : 9, RETURN : 13, ESC : 27, LEFT : 37, UP : 38, RIGHT : 39, DOWN : 40, HOME : 36, END : 35, SPACE: 32 }; // Keys "enum"
  var defaultSettings = {
    triggerChar   : '@',
    onDataRequest : $.noop,
    minChars      : 1,
    forcePos      : null,
    classes       : {
      autoCompleteItemActive : "selected"
    },
    templates     : {
      wrapper                    : _.template('<div class="mentions-wrapper"></div>'),
      caretCalculator            : _.template('<div class="mentions-caret-calculator"></div>'),
      autocompleteList           : _.template('<div class="mentions-autocomplete-list"></div>'),
      autocompleteListItem       : _.template('<li><%= content %></li>'),
      mentionsOverlay            : _.template('<div class="mentions"></div>'),
      mentionItemSyntax          : _.template('@[<%= value %>](<%= id %>)'),
      mentionItemHighlight       : _.template('<strong><%= value %></strong>')
    }
  };

  var utils = {
    htmlEncode       : function (str) {
      return _.escape(str);
    },
    setCaretPosition : function (domNode, caretPos) {
      if (domNode.createTextRange) {
        var range = domNode.createTextRange();
        range.move('character', caretPos);
        range.select();
      } else {
        if (domNode.selectionStart) {
          domNode.focus();
          domNode.setSelectionRange(caretPos, caretPos);
        } else {
          domNode.focus();
        }
      }
    },
    rtrim: function(string) {
      return string.replace(/\s+$/,"");
    }
  };


  function _copyStyles(styles, $from, $to) {
    $.each(styles, function(i, style) {
      $to.css(style, $from.css(style));
    });
  }

  var MentionsInput = function (settings) {

    var elmInputBox, elmInputWrapper, elmAutocompleteList, elmWrapperBox, elmMentionsOverlay, elmActiveAutoCompleteItem, elmCaretCalculator;
    var mentionsCollection = [];
    var autocompleteItemCollection = {};
    var inputBuffer = [];
    var currentDataQuery;

    settings = $.extend(true, {}, defaultSettings, settings );

    function initWrapper() {
      elmInputWrapper = elmInputBox.parent();
      elmWrapperBox = $(settings.templates.wrapper());
      var hasFocus = elmInputBox.is(":focus");
      elmInputBox.wrapAll(elmWrapperBox);
      if (hasFocus) {
        elmInputBox.focus();
      }
      elmWrapperBox = elmInputWrapper.find('> div.mentions-wrapper');
      elmWrapperBox.css({
        position: "relative",
        boxSizing: "border-box",
        width: elmInputBox.outerWidth()
      });

      _copyStyles([
        "display",
        "backgroundColor",
        "backgroundImage",
        "backgroundRepeat",
        "backgroundSize",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderTopStyle",
        "borderRightStyle",
        "borderBottomStyle",
        "borderLeftStyle",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor"
      ], elmInputBox, elmWrapperBox);

      elmInputBox.css({
        border: "none",
        background: "transparent"
      });
    }

    function initTextarea() {
      elmInputBox.css({
        resize: "none",
        position: "relative"
      });
      elmInputBox.attr('data-mentions-input', 'true');
      elmInputBox.bind('keydown', onInputBoxKeyDown);
      elmInputBox.bind('keypress', onInputBoxKeyPress);
      elmInputBox.bind('input', onInputBoxInput);
      elmInputBox.bind('click', onInputBoxClick);
      elmInputBox.bind('blur', onInputBoxBlur);
    }

    function initCaretCalculator() {
      elmCaretCalculator = $(settings.templates.caretCalculator());
      elmCaretCalculator.appendTo(elmWrapperBox);

      elmCaretCalculator.css({
        top:        0,
        left:       0,
        right:      0,
        bottom:     0,
        position:   "absolute",
        whiteSpace: "pre-wrap",
        wordWrap:   "break-word",
        display:    "none"
      });

      _copyStyles([
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "overflow",
        "letterSpacing",
        "fontSize",
        "fontFamily",
        "fontStyle",
        "fontWeight",
        "lineHeight",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderTopStyle",
        "borderRightStyle",
        "borderBottomStyle",
        "borderLeftStyle",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor"
      ], elmInputBox, elmCaretCalculator);
    }

    function initAutocomplete() {
      elmAutocompleteList = $(settings.templates.autocompleteList());
      elmAutocompleteList.appendTo(elmWrapperBox);
      elmAutocompleteList.delegate('li', 'mousedown', onAutoCompleteItemClick);

      elmAutocompleteList.css({
        position: "absolute",
        cursor:   "pointer"
      });
    }

    function initMentionsOverlay() {
      elmMentionsOverlay = $(settings.templates.mentionsOverlay());
      elmMentionsOverlay.prependTo(elmWrapperBox);

      // TODO add border-radius
      _copyStyles([
        "display",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "overflow",
        "letterSpacing",
        "fontSize",
        "fontFamily",
        "fontStyle",
        "fontWeight",
        "lineHeight",
        "boxSizing"
      ], elmInputBox, elmMentionsOverlay);

      elmMentionsOverlay.css({
        top:        0,
        left:       0,
        bottom:     0,
        right:      0,
        color:      "transparent",
        position:   "absolute",
        whiteSpace: "pre-wrap",
        wordWrap:   "break-word"
      });

      if (navigator.userAgent.indexOf("Firefox/") !== -1) {
        elmMentionsOverlay.css({
          top:            elmInputBox.css("paddingTop"),
          right:          elmInputBox.css("paddingRight"),
          bottom:         elmInputBox.css("paddingBottom"),
          left:           elmInputBox.css("paddingLeft"),
          paddingTop:     "",
          paddingRight:   "",
          paddingBottom:  "",
          paddingLeft:    ""
        });
      }

      elmInputBox.bind('scroll', function() {
        elmMentionsOverlay.scrollTop(elmInputBox.scrollTop());
        elmMentionsOverlay.scrollLeft(elmInputBox.scrollLeft());
      });
    }

    function updateValues() {
      var syntaxMessage = getInputBoxValue();
      _.each(mentionsCollection, function (mention) {
        var textSyntax = settings.templates.mentionItemSyntax(mention);
        syntaxMessage = syntaxMessage.replace(mention.value, textSyntax);
      });

      var mentionText = utils.htmlEncode(syntaxMessage);

      _.each(mentionsCollection, function (mention) {
        var formattedMention = _.extend({}, mention, {value: mention.value});
        var textSyntax = utils.htmlEncode(settings.templates.mentionItemSyntax(formattedMention));
        formattedMention.value = utils.htmlEncode(formattedMention.value);
        var textHighlight = settings.templates.mentionItemHighlight(formattedMention);
        mentionText = mentionText.replace(textSyntax, textHighlight);
      });

      mentionText = mentionText.replace(/\n/g, '<br>');
      mentionText = mentionText.replace(/<br>$/g, '<br>&nbsp;');
      mentionText = mentionText.replace(/ {2}/g, '&nbsp; ');

      elmInputBox.data('messageText', syntaxMessage);
      elmMentionsOverlay.html(mentionText);
    }

    function resetBuffer() {
      inputBuffer = [];
    }

    function updateMentionsCollection() {
      var inputText = getInputBoxValue();

      var oldLength = mentionsCollection.length;

      mentionsCollection = _.reject(mentionsCollection, function (mention) {
        return !mention.value || inputText.indexOf(mention.value) == -1;
      });
      mentionsCollection = _.compact(mentionsCollection);

      var newLength = mentionsCollection.length;

      if (oldLength !== newLength) {
        elmInputBox.trigger("mentionremove", [mentionsCollection]);
      }
    }

    function addMention(mention) {

      var currentMessage = getInputBoxValue();

      var fullQuery = settings.triggerChar + currentDataQuery;
      var firstIndex = currentMessage.indexOf(fullQuery, (elmInputBox[0].selectionEnd || 0) - fullQuery.length);
      var lastIndex = firstIndex + currentDataQuery.length + 1;

      var startCaretPosition = firstIndex;
      var currentCaretPosition = lastIndex;

      var start = currentMessage.substr(0, startCaretPosition);
      var end = currentMessage.substr(currentCaretPosition, currentMessage.length);
      var startEndIndex = (start + mention.value).length + 1;

      mentionsCollection.push(mention);

      // Cleaning before inserting the value, otherwise auto-complete would be triggered with "old" inputbuffer
      resetBuffer();
      currentDataQuery = '';
      hideAutoComplete();

      // Mentions & syntax message
      var updatedMessageText = start + mention.value + ' ' + end;
      elmInputBox.val(updatedMessageText);
      updateValues();

      // Set correct focus and selection
      elmInputBox.focus();
      utils.setCaretPosition(elmInputBox[0], startEndIndex);

      elmInputBox.trigger("mentionadd", [mentionsCollection]);
    }

    function getInputBoxValue() {
      return elmInputBox.val();
    }

    function onAutoCompleteItemClick() {
      var elmTarget = $(this);
      var mention = autocompleteItemCollection[elmTarget.attr('data-uid')];

      addMention(mention);

      return false;
    }

    function onInputBoxClick() {
      resetBuffer();
    }

    function onInputBoxBlur() {
      hideAutoComplete();
    }

    function onInputBoxInput() {
      updateValues();
      updateMentionsCollection();
      var triggerCharIndex = _.lastIndexOf(inputBuffer, settings.triggerChar);
      if (triggerCharIndex > -1) {
        currentDataQuery = inputBuffer.slice(triggerCharIndex + 1).join('');
        currentDataQuery = utils.rtrim(currentDataQuery);

        _.defer(_.bind(doSearch, this, currentDataQuery));
      }
    }

    function onInputBoxKeyPress(e) {
      if(e.keyCode !== KEY.BACKSPACE) {
        var typedValue = String.fromCharCode(e.which || e.keyCode);
        inputBuffer.push(typedValue);
      }
    }

    function onInputBoxKeyDown(e) {

      // This also matches HOME/END on OSX which is CMD+LEFT, CMD+RIGHT
      if (e.keyCode == KEY.LEFT || e.keyCode == KEY.RIGHT || e.keyCode == KEY.HOME || e.keyCode == KEY.END) {
        // Defer execution to ensure carat pos has changed after HOME/END keys
        _.defer(resetBuffer);

        // IE9 doesn't fire the oninput event when backspace or delete is pressed. This causes the highlighting
        // to stay on the screen whenever backspace is pressed after a highlighed word. This is simply a hack
        // to force updateValues() to fire when backspace/delete is pressed in IE9.
        if (navigator.userAgent.indexOf("MSIE 9") > -1) {
          _.defer(updateValues);
        }

        return;
      }

      if (e.keyCode == KEY.BACKSPACE) {
        inputBuffer = inputBuffer.slice(0, -1 + inputBuffer.length); // Can't use splice, not available in IE
        _.defer(hideAutoComplete);
        return;
      }

      if (!elmAutocompleteList.is(':visible')) {
        return true;
      }

      switch (e.keyCode) {
        case KEY.UP:
        case KEY.DOWN:
          var elmCurrentAutoCompleteItem = null;
          if (e.keyCode == KEY.DOWN) {
            if (elmActiveAutoCompleteItem && elmActiveAutoCompleteItem.length) {
              elmCurrentAutoCompleteItem = elmActiveAutoCompleteItem.next();
            } else {
              elmCurrentAutoCompleteItem = elmAutocompleteList.find('li').first();
            }
          } else {
            elmCurrentAutoCompleteItem = $(elmActiveAutoCompleteItem).prev();
          }

          if (elmCurrentAutoCompleteItem.length) {
            selectAutoCompleteItem(elmCurrentAutoCompleteItem);
            return false;
          }
          break;

        case KEY.RETURN:
        case KEY.TAB:
          if (elmActiveAutoCompleteItem && elmActiveAutoCompleteItem.length) {
            elmActiveAutoCompleteItem.trigger('mousedown');
            return false;
          }

          break;

        case KEY.ESC:
          hideAutoComplete();
          return false;

        case KEY.SPACE:
          var mention = autocompleteItemCollection[elmActiveAutoCompleteItem.attr('data-uid')];
          if (mention.value.toLowerCase() === (settings.triggerChar + currentDataQuery).toLowerCase()) {
            elmActiveAutoCompleteItem.trigger('mousedown');
            return false;
          }
      }

      return true;
    }

    function hideAutoComplete() {
      elmActiveAutoCompleteItem = null;
      if (elmAutocompleteList) {
        elmAutocompleteList.empty().hide();
      }
    }

    function getTriggerCharOffset() {
      var val = elmInputBox.val();
      var pos = val.substr(0, elmInputBox.prop("selectionEnd")).lastIndexOf(settings.triggerChar) + settings.triggerChar.length;
      var placeholder = "|-#-|";
      val = val.substr(0, pos) + placeholder + val.substr(pos);
      val = utils.htmlEncode(val);
      val = val.replace(placeholder, "<span>.</span>");
      val = val.replace(/\n/g, '<br>');
      val = val.replace(/<br>$/g, '<br>&nbsp;');
      elmCaretCalculator.html(val);
      elmCaretCalculator.show();
      elmCaretCalculator.scrollTop(elmInputBox.scrollTop());
      elmCaretCalculator.scrollLeft(elmInputBox.scrollLeft());
      var $position = elmCaretCalculator.find("span");
      var offset = $position.offset();
      $position.remove();
      elmCaretCalculator.hide();
      return offset;
    }

    function showAutoComplete() {
      elmAutocompleteList.show();
      var offset = getTriggerCharOffset();
      var height = elmAutocompleteList.outerHeight();
      var width = elmAutocompleteList.outerWidth();
      var scrollTop = $window.scrollTop();
      var scrollLeft = $window.scrollLeft();
      var windowHeight = $window.height();
      var windowWidth = $window.width();
      var top = offset.top + 20;
      var left = offset.left;

      if ((top + height) > (windowHeight + scrollTop) || settings.forcePos === "top") {
        top = offset.top - height;
      }

      if ((left + width) > (windowWidth + scrollLeft)) {
        left = offset.left - width;
      }

      elmAutocompleteList.offset({ top: top, left: left });
    }

    function selectAutoCompleteItem(elmItem) {
      elmItem.addClass(settings.classes.autoCompleteItemActive);
      elmItem.siblings().removeClass(settings.classes.autoCompleteItemActive);

      elmActiveAutoCompleteItem = elmItem;
    }

    function populateDropdown(query, results) {
      // Filter items that has already been mentioned
      var mentionValues = _.pluck(mentionsCollection, 'value');
      results = _.reject(results, function (item) {
        return _.include(mentionValues, item.name);
      });

      if (!results.length) {
        hideAutoComplete();
        return;
      }

      elmAutocompleteList.empty();
      var elmDropDownList = $("<ul>").appendTo(elmAutocompleteList).hide();

      _.each(results, function (item, index) {
        var itemUid = _.uniqueId('mention_');

        autocompleteItemCollection[itemUid] = _.extend({}, item, {value: item.name});

        var elmListItem = $(settings.templates.autocompleteListItem({
          id      : utils.htmlEncode(item.id),
          content : utils.htmlEncode(item.name)
        })).attr('data-uid', itemUid);

        if (index === 0) {
          selectAutoCompleteItem(elmListItem);
        }
        elmListItem = elmListItem.appendTo(elmDropDownList);
      });

      elmDropDownList.show();
      showAutoComplete();
    }

    function doSearch(query) {
      if (typeof(query) === "string" && query.length >= settings.minChars) {
        settings.onDataRequest.call(this, query, function (responseData) {
          populateDropdown(query, responseData);
        });
      } else {
        hideAutoComplete();
      }
    }

    function resetInput() {
      elmInputBox.val('');
      mentionsCollection = [];
      updateValues();
      elmInputBox.trigger("mentionreset", [mentionsCollection]);
    }

    // Public methods
    return {
      init : function (domTarget) {
        elmInputBox = $(domTarget);
        if (elmInputBox.attr('data-mentions-input') == 'true') {
          return;
        }

        initTextarea();
        initWrapper();
        initAutocomplete();
        initMentionsOverlay();
        initCaretCalculator();
        resetInput();
      },

      val : function (callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        var value = mentionsCollection.length ? elmInputBox.data('messageText') : getInputBoxValue();
        callback.call(this, value);
      },

      reset : function () {
        resetInput();
      },

      getMentions : function (callback) {
        if (!_.isFunction(callback)) {
          return;
        }

        callback.call(this, mentionsCollection);
      },

      setMentions : function(mentions) {
        mentionsCollection = mentions;
        resetBuffer();
        updateValues();
        if (mentions.length) {
          elmInputBox.trigger("mentionadd", [mentionsCollection]);
        }
      }
    };
  };

  $.fn.mentionsInput = function (method, settings) {

    var outerArguments = arguments;

    if (typeof method === 'object' || !method) {
      settings = method;
    }

    return this.each(function () {
      var instance = $.data(this, 'mentionsInput') || $.data(this, 'mentionsInput', new MentionsInput(settings));

      if (_.isFunction(instance[method])) {
        return instance[method].apply(this, Array.prototype.slice.call(outerArguments, 1));

      } else if (typeof method === 'object' || !method) {
        return instance.init.call(this, this);

      } else {
        $.error('Method ' + method + ' does not exist');
      }

    });
  };

})(jQuery, _);