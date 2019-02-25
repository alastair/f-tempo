
//This code came from http://blog.benoitvallon.com/data-structures-in-javascript/the-trie-data-structure/

function Node(data) {
  this.data = data;
  this.isWord = false;
  this.prefixes = 0;
  this.children = {};
  
  this.idSet = new Set();
}

function Trie() {
  this.root = new Node('');
}
Trie.prototype.add = function(word) {
  if(!this.root) {
    return null;
  }
  this._addNode(this.root, word);
};
Trie.prototype._addNode = function(node, word) {
  if(!node || !word) {
    return null;
  }
  node.prefixes++;
  var letter = word.charAt(0);
  var child = node.children[letter];
  if(!child) {
    child = new Node(letter);
    node.children[letter] = child;
  }
  var remainder = word.substring(1);
  if(!remainder) {
    child.isWord = true;
  }
  this._addNode(child, remainder);
};

/***********************/
// ids added by TC 1 Nov 2017
Trie.prototype.id_add = function(word, id) {
  if(!this.root) {
    return null;
  }
  var child = this._id_addNode(this.root, word, id);
};
Trie.prototype._id_addNode = function(node, word, id) {
  if(!node || !word || !id) {
    return null;
  }
  node.prefixes++;
  var letter = word.charAt(0);
  var child = node.children[letter];
  if(!child) {
    child = new Node(letter);
    node.children[letter] = child;
  }
  var remainder = word.substring(1);
  if(!remainder) {
    child.idSet.add(id);
 //   console.log(word+" added; now "+child.idSet.size+" ids ");
    child.isWord = true;
  }
  this._id_addNode(child, remainder, id);
  return child;
};

Trie.prototype.getIDs = function(word) {
  if(!this.root) {
    return null;
  }
  return this._getIDs(this.root, word);
};
// _getIDs is just a version of _contains which returns child.idSet
Trie.prototype._getIDs = function(node, word) {
  if(!node || !word) {
    return false;
  }
  var letter = word.charAt(0);
  var child = node.children[letter];
  if(child) {
    var remainder = word.substring(1);
    if(!remainder && child.isWord) {
      return child.idSet;
    } else {
      return this._getIDs(child, remainder);
    }
  } else {
    return false;
  }
};

/**********************/

Trie.prototype.remove = function(word) {
  if(!this.root) {
    return;
  }
  if(this.contains(word)) {
    this._removeNode(this.root, word);
  }
};
Trie.prototype._removeNode = function(node, word) {
  if(!node || !word) {
    return;
  }
  node.prefixes--;
  var letter = word.charAt(0);

  var child = node.children[letter];
  if(child) {
    var remainder = word.substring(1);
    if(remainder) {
      if(child.prefixes === 1) {
        delete node.children[letter];
      } else {
        this._removeNode(child, remainder);
      }
    } else {
      if(child.prefixes === 0) {
        delete node.children[letter];
      } else {
        child.isWord = false;
      }
    }
  }
};
Trie.prototype.contains = function(word) {
  if(!this.root) {
    return false;
  }
  return this._contains(this.root, word);
};
Trie.prototype._contains = function(node, word) {
  if(!node || !word) {
    return false;
  }
  var letter = word.charAt(0);
  var child = node.children[letter];
  if(child) {
    var remainder = word.substring(1);
    if(!remainder && child.isWord) {
      return true;
    } else {
      return this._contains(child, remainder);
    }
  } else {
    return false;
  }
};
Trie.prototype.countWords = function() {
  if(!this.root) {
    return console.log('No root node found');
  }
  var queue = [this.root];
  var counter = 0;
  while(queue.length) {
    var node = queue.shift();
    if(node.isWord) {
      counter++;
    }
    for(var child in node.children) {
      if(node.children.hasOwnProperty(child)) {
        queue.push(node.children[child]);
      }
    }
  }
  return counter;
};
Trie.prototype.getWords = function() {
  var words = [];
  var word = '';
  this._getWords(this.root, words, words, word);
  return words;
};
Trie.prototype._getWords = function(node, words, word) {
  for(var child in node.children) {
    if(node.children.hasOwnProperty(child)) {
      word += child;
      if (node.children[child].isWord) {
        words.push(word);
      }
      this._getWords(node.children[child], words, word);
      word = word.substring(0, word.length - 1);
    }
  }
};
Trie.prototype.print = function() {
  if(!this.root) {
    return console.log('No root node found');
  }
  var newline = new Node('|');
  var queue = [this.root, newline];
  var string = '';
  while(queue.length) {
    var node = queue.shift();
    string += node.data.toString() + ' ';
    if(node === newline && queue.length) {
      queue.push(newline);
    }
    for(var child in node.children) {
      if(node.children.hasOwnProperty(child)) {
        queue.push(node.children[child]);
      }
    }
  }
  console.log(string.slice(0, -2).trim());
};
Trie.prototype.printByLevel = function() {
  if(!this.root) {
    return console.log('No root node found');
  }
  var newline = new Node('\n');
  var queue = [this.root, newline];
  var string = '';
  while(queue.length) {
    var node = queue.shift();
    string += node.data.toString() + (node.data !== '\n' ? ' ' : '');
    if(node === newline && queue.length) {
      queue.push(newline);
    }
    for(var child in node.children) {
      if(node.children.hasOwnProperty(child)) {
        queue.push(node.children[child]);
      }
    }
  }
  console.log(string.trim());
};

var trie = new Trie();
/*
//trie.add('C-dDAcCa-');
//trie.add('b-dDAcCab');
//trie.add('AAAAAAAAA');
//trie.add('dAAAAAAAa');
trie.id_add('C-dDAcCa-',"id1");
trie.id_add('b-dDAcCab',"id1");
trie.id_add('AAAAAAAAA',"id2");
trie.id_add('dAAAAAAAa');
trie.print(); // => | o t f | n w i | e o f | t | h y
trie.printByLevel(); // => o t f \n n w i \n e o f \n t \n h y
//console.log('words are: ', trie.getWords()); // => [ 'one', 'two', 'fifth', 'fifty' ]
console.log('trie count words is: ', trie.countWords()); // => 4
console.log('trie contains CAAAbAAbC is true:', trie.contains('CAAAbAAbC')); // => true
console.log('trie contains lxy-BQNat is false:', trie.contains('lxy-BQNat')); // => false
*/
