(function () {

  function xToOffsetX(ox) {
    return ox + W / 2;
  }

  function yToOffsetY(oy) {
    return H / 2 - oy;
  }

  function offsetXToX(x) {
    return x - W / 2;
  }

  function offsetYToY(y) {
    return H / 2 - y;
  }

  function repeat(n, val) {
    var arr = [];
    while (n-- > 0) arr.push(val);
    return arr;
  }

  function times(n, func) {
    for (var i = 0; i < n; i++) func(i);
  }

  function shuffle(array) {
    var newArray = array.slice(0);
    var size = array.length;

    newArray.forEach((_, i) => {
      var j = Math.random() * size | 0;
      var tmp = newArray[i];
      newArray[i] = newArray[j];
      newArray[j] = tmp;
    });

    return newArray;
  }

  function range(start, end) {
    if (typeof end === 'undefined') {
      end = start;
      start = 0;
    }

    var array = [], i;
    for (i = start; i < end; i++) {
      array.push(i);
    }
    return array;
  }


  class Matrix {
    constructor(rows, cols, values) {
      this.rows = rows;
      this.cols = cols;

      this.values = repeat(rows * cols, 0);

      if (values) {
        var n = Math.min(values.length, this.values.length);
        for (var i = 0; i < n; i++) this.values[i] = values[i];
      }
    }

    _validateIndex(i, j) {
      if (i < 0 || i >= this.rows || j < 0 || j >= this.cols) {
        console.log(this, i, j);
        throw Error('out of range');
      }
    }

    get(i, j) {
      this._validateIndex(i, j);
      return this.values[i * this.cols + j];
    }

    set(i, j, val) {
      this._validateIndex(i, j);
      this.values[i * this.cols + j] = val;
    }

    forEach(func) {
      times(this.rows, (i) => {
        times(this.cols, (j) => {
          func(this.get(i, j), i, j, this);
        });
      });
    }

    map(func) {
      var mat = new Matrix(this.rows, this.cols);
      this.forEach((x, i, j) => { mat.set(i, j, func(x, i, j, this)); });
      return mat;
    }

    isSameSize(other) {
      return other.rows === this.rows && other.cols === this.cols;
    }

    op(other, func) {
      if (!this.isSameSize(other)) throw Error('wrong size');

      return this.map((x, i, j) => func(x, other.get(i, j)));
    }

    add(other) {
      if (typeof other === 'number') return this.map((x) => x + other);

      return this.op(other, (a, b) => a + b);
    }

    sub(other) {
      if (typeof other === 'number') return this.map((x) => x - other);

      return this.op(other, (a, b) => a - b);
    }

    mul(other) {
      if (typeof other === 'number') return this.map((x) => x * other);

      if (this.cols !== other.rows) throw Error('wrong size to multiply');

      var n = this.cols;
      var mat = new Matrix(this.rows, other.cols);

      mat.forEach((_, i, j) => {
        var s = 0;
        times(n, (k) => {
          s += this.get(i, k) * other.get(k, j);
        });
        mat.set(i, j, s);
      });

      return mat;
    }

    mulElementwise(other) {
      if (!this.isSameSize(other)) {
        throw new Error('wrong size to multiply entry wise');
      }

      return Matrix.build(this.rows, this.cols, (i, j) => {
        return this.get(i, j) * other.get(i, j);
      });
    }

    div(k) {
      return this.map((x) => x / k);
    }

    transpose() {
      return Matrix.build(this.cols, this.rows, (i, j) => this.get(j, i));
    }

    copy() {
      return new Matrix(this.rows, this.cols, this.values.slice(0));
    }

    fill(val) {
      return this.map(() => val);
    }
  }

  Matrix.build = function (rows, cols, func) {
    var mat = new Matrix(rows, cols);
    mat.forEach((_, i, j) => {
      mat.set(i, j, func(i, j));
    });
    return mat;
  };

  Matrix.identity = function (size) {
    return Matrix.build(size, size, (i, j) => i === j ? 1 : 0);
  };

  class Vector extends Matrix {
    constructor(n, values) {
      super(1, n, values);
    }
  }

  Array.prototype.sum = function (s0) {
    s0 || (s0 = 0);
    return this.reduce((a, b) => a + b, s0);
  };

  function rand(min, max) {
    if (typeof max === 'undefined') {
      max = min;
      min = 0;
    }
    return Math.random() * (max - min) + min;
  }

  var max = Math.max;
  var min = Math.min;


  /////////////////////////


  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var resetButton = document.getElementById('reset');
  var startAndStopButton = document.getElementById('start-and-stop');
  var errorNum = document.getElementById('error-num');

  canvas.addEventListener('click', onClickCanvas);
  resetButton.addEventListener('click', reset);
  startAndStopButton.addEventListener('click', onClickStartAndStopButton);

  var W = 500, H = 500;

  canvas.height = H;
  canvas.width = W;

  var N_NODES = Object.freeze([2, 60, 1]);
  var points;
  var w1, w2;
  var timer;
  var INTERVAL = 30;
  var learning = false;

  var f1 =  (x) => x > 0 ? x : 0;
  var f1_ = (x) => x > 0 ? 1 : 0;
  var f2 =  (x) => x;
  var f2_ = (x) => 1;

  var E  = (y, t) => Math.pow(y - t, 2) / 2;
  var E_ = (y, t) => y - t;

  function reset(p) {
    points = [];
    var r = () => rand(-2, 2);
    w1 = Matrix.build(N_NODES[0], N_NODES[1], (i, j) => {
      if (i == 0) return rand(-100, 100);
      return rand(-1, 1);
    });
    w2 = Matrix.build(N_NODES[1], N_NODES[2], () => rand(-1, 1));

    errorNum.innerText = '';

    render();

    stopLearning();
  }
  reset();
  startLearning();

  function onClickCanvas(event) {
    var ox = event.offsetX;
    var oy = event.offsetY;
    points.push([offsetXToX(ox), offsetYToY(oy)]);
    render();
  }

  function startLearning() {
    learning = true;
    startAndStopButton.innerText = 'stop';
    timer = setInterval(adjust, INTERVAL);
  }

  function stopLearning() {
    learning = false;
    startAndStopButton.innerText = 'start';
    clearInterval(timer);
  }

  function onClickStartAndStopButton() {
    if (learning) {
      stopLearning();
    } else {
      startLearning();
    }
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    ctx.beginPath();
    ctx.moveTo(0, H / 2 - 0.5);
    ctx.lineTo(W, H / 2 - 0.5);
    ctx.moveTo(W / 2 - 0.5, 0);
    ctx.lineTo(W / 2 - 0.5, H);
    ctx.stroke();

    points.forEach((p) => {
      var ox = xToOffsetX(p[0]);
      var oy = yToOffsetY(p[1]);
      ctx.beginPath();
      ctx.arc(ox, oy, 5, 0, Math.PI * 2, false);
      ctx.fill();
    });

    renderCurve();
  }

  function renderCurve() {
    var x, y;
    var ox, oy;
    ctx.beginPath()
    for (ox = 0; ox < W; ox++) {
      x = offsetXToX(ox);
      var m = new Vector(2, [1, x]).mul(w1).map(f1).mul(w2).map(f2);
      y = m.get(0, 0);
      oy = yToOffsetY(y)
      if (ox === 0) {
        ctx.moveTo(ox, oy);
      } else {
        ctx.lineTo(ox, oy);
      }
    }
    ctx.stroke();
  }

  function dropOut(w, r, func) {
    func(w.map((v, i, j) => Math.random() > r ? 0 : v));
  }

  function adjust() {
    if (points.length === 0) return;

    var e = 0;

    shuffle(points).forEach((p, i) => {
      var px = p[0], py = p[1];

      var x = new Vector(2, [1, px]);
      var v1 = x .mul(w1);
      var y1 = v1.map(f1);
      var v2 = y1.mul(w2);
      var y2 = v2.map(f2);

      var w2_ = w2.map((w, j, k) => {
        var r = 0.000001;
        var d = r * E_(y2.get(0, k), py) * f2_(v2.get(0, k)) * y1.get(0, j);
        return w - d;
      });

      var w1_ = w1.map((w, i, j) => {
        var r = 0.000001;
        var k = 0;
        var d = r * E_(y2.get(0, k), py) * f2_(v2.get(0, k)) * w2.get(j, k) *
            f1_(v1.get(0, j)) * x.get(0, i);
        return w - d;
      });

      w1 = w1_;
      w2 = w2_;

      e += E(y2.get(0, 0), py);
    });

    var ea = e / points.length;
    console.log('error:', ea);

    errorNum.innerText = ea.toExponential(4);
    if (ea < 10) stopLearning();

    render();
  }

})();
