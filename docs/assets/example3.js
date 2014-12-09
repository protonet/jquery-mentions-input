$(function () {


  var mentionInput = new MentionsInput('textarea.mention-example3');
  mentionInput.add("@", {
    fetch: function(query, callback) {
      var data = [
        { id:1, name:'Kenneth Auchenberg', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:2, name:'Jon Froda', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:3, name:'Anders Pollas', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:4, name:'Kasper Hulthin', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:5, name:'Andreas Haugstrup', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:6, name:'Pete Lacey', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:7, name:'kenneth@auchenberg.dk', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:8, name:'Pete Awesome Lacey', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:9, name:'Kenneth Hulthin', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' }
      ];

      data = _.filter(data, function(item) { return item.name.toLowerCase().indexOf(query.toLowerCase()) > -1; });

      callback.call(this, data);
    }
  });
  
  mentionInput.add(":", {
    fetch: function(query, callback) {
      var data = [
        { id:1, name:'hash', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:2, name:'foo', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' },
        { id:3, name:'bar', 'avatar':'http://cdn0.4dots.com/i/customavatars/avatar7112_1.gif' }
      ];

      data = _.filter(data, function(item) { return item.name.toLowerCase().indexOf(query.toLowerCase()) > -1; });

      callback.call(this, data);
    }
  });

});