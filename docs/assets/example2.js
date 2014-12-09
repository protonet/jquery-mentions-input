$(function () {
  var mentionsInput = new MentionsInput('textarea.mention-example2');
  mentionsInput.add("@", {
    fetch: function(query, callback) {
      $.getJSON('assets/data.json', function(responseData) {
        responseData = _.filter(responseData, function(item) { return item.name.toLowerCase().indexOf(query.toLowerCase()) > -1; });
        callback.call(this, responseData);
      });
    }
  });
});