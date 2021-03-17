"use strict";
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class Queue {
            constructor(strategy) {
                this.queue = [];
                this.totalSize = 0;
                this.strategy = Streams.QueuingStrategy.normalize(strategy);
            }
            /** @throws if error occurs in strategy.size function */
            put(item) {
                if (item === Streams.CLOSE_SENTINEL) {
                    this.queue.push([item, 0]);
                    return;
                }
                const size = this.strategy.size(item);
                WHATWG.guard(size > 0, new RangeError());
                this.queue.push([item, size]);
                this.totalSize += size;
            }
            /** @throws if error occurs in strategy.size function */
            take() {
                WHATWG.assert(this.queue.length > 0);
                const [item, size] = this.queue[0];
                this.totalSize -= size;
                /** rounding errors @see https://streams.spec.whatwg.org/#dequeue-value */
                if (this.totalSize < 0) {
                    this.totalSize = 0;
                }
                this.queue.shift();
                return item;
            }
            peek() {
                const [item] = this.queue[0];
                return item;
            }
            /** @throws if error occurs in strategy.size function */
            unshift(item) {
                const size = this.strategy.size(item);
                WHATWG.guard(size > 0, new RangeError());
                this.queue.unshift([item, size]);
                this.totalSize += size;
            }
            get size() {
                return this.totalSize;
            }
            get empty() {
                return this.queue.length === 0;
            }
            reset() {
                this.queue.length = 0;
                this.totalSize = 0;
            }
            /** indicates whether should put items */
            get desiredSize() {
                return this.strategy.highWaterMark - this.totalSize;
            }
            /** indicates whether should take items */
            get thresholdSize() {
                var _a;
                return ((_a = this.strategy.lowWaterMark) !== null && _a !== void 0 ? _a : 0) - this.totalSize;
            }
        }
        Streams.Queue = Queue;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class CountQueuingStrategy {
            constructor(init) {
                WHATWG.guard(init !== null);
                WHATWG.guard('highWaterMark' in init);
                this.highWaterMark = Number(init.highWaterMark);
            }
            size() {
                return 1;
            }
        }
        Streams.CountQueuingStrategy = CountQueuingStrategy;
        class ByteLengthQueuingStrategy {
            constructor(init) {
                WHATWG.guard(init !== null);
                WHATWG.guard('highWaterMark' in init);
                this.highWaterMark = Number(init.highWaterMark);
            }
            size(chunk) {
                return chunk.byteLength;
            }
        }
        Streams.ByteLengthQueuingStrategy = ByteLengthQueuingStrategy;
        let QueuingStrategy;
        (function (QueuingStrategy) {
            const isValidSize = (size) => typeof size === 'number' && !Number.isNaN(size) && size >= 0;
            function normalize(strategy, type) {
                WHATWG.guard(strategy !== null);
                WHATWG.guard(typeof type === 'undefined' || type === 'bytes');
                let { highWaterMark, size } = strategy !== null && strategy !== void 0 ? strategy : {};
                WHATWG.guard(typeof size === 'undefined' || typeof size === 'function');
                if (typeof highWaterMark !== 'undefined') {
                    highWaterMark = Number(highWaterMark);
                    WHATWG.guard(isValidSize(highWaterMark), new RangeError());
                }
                if (type !== 'bytes') {
                    highWaterMark !== null && highWaterMark !== void 0 ? highWaterMark : (highWaterMark = 1);
                    if (typeof size === 'undefined') {
                        return new CountQueuingStrategy({ highWaterMark });
                    }
                    const unsafeSize = size;
                    size = (chunk) => {
                        const size = unsafeSize(chunk);
                        WHATWG.guard(isValidSize(size), new RangeError());
                        WHATWG.guard(Number.isFinite(size), new RangeError());
                        return size;
                    };
                    return { highWaterMark, size };
                }
                WHATWG.assert(type === 'bytes');
                WHATWG.guard(typeof size === 'undefined');
                highWaterMark !== null && highWaterMark !== void 0 ? highWaterMark : (highWaterMark = 0);
                return new ByteLengthQueuingStrategy({ highWaterMark });
            }
            QueuingStrategy.normalize = normalize;
        })(QueuingStrategy = Streams.QueuingStrategy || (Streams.QueuingStrategy = {}));
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        let RunloopState;
        (function (RunloopState) {
            RunloopState[RunloopState["Running"] = 1] = "Running";
            RunloopState[RunloopState["Waiting"] = 2] = "Waiting";
            RunloopState[RunloopState["Finished"] = 16] = "Finished";
            RunloopState[RunloopState["Stopped"] = 32] = "Stopped";
            RunloopState[RunloopState["Errored"] = 64] = "Errored";
            RunloopState[RunloopState["Finishing"] = 17] = "Finishing";
            RunloopState[RunloopState["Stopping"] = 33] = "Stopping";
            RunloopState[RunloopState["Erroring"] = 65] = "Erroring";
            RunloopState[RunloopState["Cycling"] = 3] = "Cycling";
            RunloopState[RunloopState["Terminating"] = 113] = "Terminating";
            RunloopState[RunloopState["Terminated"] = 112] = "Terminated";
            RunloopState[RunloopState["All"] = 115] = "All";
        })(RunloopState = Streams.RunloopState || (Streams.RunloopState = {}));
        class Runloop {
            constructor() {
                this.requests = [];
                this.observers = [];
                this.state = 0;
                this.generator = this.startGenerator();
                this.locked = false;
                this.disabled = false;
            }
            get idle() {
                return this.requests.length === 0;
            }
            /** @ensure_entered */
            resume() {
                if (!this.ensureEntered('resume')) {
                    return false;
                }
                if (!this.locked) {
                    this.generator.next();
                }
                return true;
            }
            /** @throws @ensure_entered */
            stop() {
                if (!this.ensureEntered('stop')) {
                    return false;
                }
                this.state |= RunloopState.Stopping;
                if (!this.locked) {
                    this.generator.return();
                }
                return true;
            }
            /** @ensure_entered */
            error(e) {
                if (!this.ensureEntered('error')) {
                    return false;
                }
                this.state |= RunloopState.Stopping | RunloopState.Erroring;
                this.storedError = e;
                if (!this.locked) {
                    try {
                        this.generator.throw(e);
                    }
                    catch (e) { }
                }
                return true;
            }
            /** @throws @ensure_entered */
            enqueueRequest(request) {
                if (!this.ensureEntered('request')) {
                    return false;
                }
                if (!(this.state & RunloopState.Running)) {
                    if (this.state & RunloopState.Errored) {
                        throw this.storedError;
                    }
                    return false;
                }
                this.requests.push(request);
                if (!this.locked) {
                    this.generator.next();
                }
                return true;
            }
            addObserver(state, handler) {
                if (this.disabled) {
                    return false;
                }
                if (this.state > 0 && !(this.state & RunloopState.Running)) {
                    return false;
                }
                this.observers.push({ state, handler });
                return true;
            }
            /** ensure entered the try-catch-finally block to catch abort signals */
            ensureEntered(action) {
                if (this.disabled) {
                    return false;
                }
                const shouldCconcernTerminated = action !== 'request';
                const shouldThrow = action === 'stop' || action === 'resume'; /* || action === 'request'*/
                if (shouldCconcernTerminated && this.isTerminated(shouldThrow)) {
                    return false;
                }
                if (this.state === 0) {
                    WHATWG.assert(!this.locked);
                    this.generator.next();
                }
                return true;
            }
            *startGenerator() {
                let sync = true;
                try {
                    this.state |= RunloopState.Running;
                    yield;
                    while (true) {
                        if (this.shouldExit()) {
                            this.state |= RunloopState.Finished;
                            return;
                        }
                        if (this.requests.length === 0 || this.shouldYield()) {
                            if (!(this.state & RunloopState.Waiting)) {
                                this.state |= RunloopState.Waiting;
                                this.notifyObservers();
                            }
                            // might receive abort signals (.stop, .error) here
                            yield;
                            // check exit or yield condition again
                            continue;
                        }
                        if (this.state & RunloopState.Waiting) {
                            this.state ^= RunloopState.Waiting;
                            this.notifyObservers();
                        }
                        const request = this.requests.shift();
                        WHATWG.assert(typeof request !== 'undefined');
                        const { next } = request;
                        sync = true;
                        // might receive abort signals during the exeuction
                        const r = this.execute(next);
                        if (r && r instanceof Promise) {
                            sync = false;
                            let settled = false;
                            r.then(() => {
                                settled = true;
                                if (this.shouldExit()) {
                                    // if should exit, ignore abort signals from outside
                                    if (this.state & RunloopState.Terminated) {
                                        this.state &= ~RunloopState.Terminated;
                                    }
                                    this.state |= RunloopState.Finished;
                                    this.generator.return();
                                }
                                else {
                                    // if (!(this.state & RunloopState.Terminated)) {
                                    this.generator.next();
                                    // }
                                }
                            }, e => {
                                settled = true;
                                if (!(this.state & RunloopState.Terminated)) {
                                    this.generator.throw(e);
                                }
                                else {
                                    this.generator.next();
                                }
                            });
                            while (!settled) {
                                // might receive abort signals here
                                try {
                                    yield;
                                }
                                catch (e) {
                                    if (settled) {
                                        throw e;
                                    }
                                }
                            }
                        }
                        if (sync) {
                            WHATWG.assert(!(this.state & RunloopState.Terminated));
                            continue;
                        }
                        // defer handling abort signals
                        if (this.state & RunloopState.Errored) {
                            throw this.storedError;
                        }
                        else if (this.state & RunloopState.Terminated) {
                            return;
                        }
                    }
                }
                catch (e) {
                    if (!(this.state & RunloopState.Errored)) {
                        this.state |= RunloopState.Errored;
                        this.storedError = e;
                        // do not rethrow error here 'cause it is unpredicatable to throw error async
                    }
                }
                finally {
                    this.notifyObservers();
                    this.state &= ~RunloopState.Cycling;
                    let pending;
                    if (this.state & RunloopState.Errored) {
                        for (const { error } of this.requests) {
                            if (typeof pending === 'undefined') {
                                try {
                                    const r = this.execute(error, this.storedError);
                                    if (r && r instanceof Promise) {
                                        pending = r;
                                    }
                                    else if (r && typeof r.then === 'function') {
                                        pending = new Promise(r.then.bind(r));
                                    }
                                }
                                catch (e) { }
                            }
                            else {
                                pending = pending.finally(() => this.execute(error, this.storedError));
                                WHATWG.HANDLED(pending);
                            }
                        }
                    }
                    else {
                        for (const { done } of this.requests) {
                            if (typeof pending === 'undefined') {
                                try {
                                    const r = this.execute(done, this.storedError);
                                    if (r && r instanceof Promise) {
                                        pending = r;
                                    }
                                    else if (r && typeof r.then === 'function') {
                                        pending = new Promise(r.then.bind(r));
                                    }
                                }
                                catch (e) { }
                            }
                            else {
                                pending = pending.finally(() => this.execute(done, this.storedError));
                                WHATWG.HANDLED(pending);
                            }
                        }
                    }
                    this.requests.length = 0;
                    if (typeof pending === 'undefined') {
                        this.notifyObservers();
                        this.observers.length = 0;
                    }
                    else {
                        pending.finally(() => {
                            this.notifyObservers();
                            this.observers.length = 0;
                        }).catch(WHATWG.NO_OP);
                    }
                }
            }
            notifyObservers() {
                this.disabled = true;
                for (const observer of this.observers.slice()) {
                    if (this.state & observer.state) {
                        try {
                            observer.handler(this.state, this.storedError);
                        }
                        catch (e) { }
                    }
                }
                this.disabled = false;
            }
            execute(callback, arg) {
                if (typeof callback !== 'function') {
                    return;
                }
                WHATWG.assert(!this.locked);
                this.locked = true;
                try {
                    return Reflect.apply(callback, null, [arg]);
                }
                finally {
                    this.locked = false;
                }
            }
            isTerminated(throws = true) {
                if (this.state & RunloopState.Errored && throws) {
                    throw this.storedError;
                }
                return (this.state & RunloopState.Terminated) !== 0;
            }
            /** to override */
            shouldExit() {
                return false;
            }
            /** to override */
            shouldYield() {
                return false;
            }
        }
        Streams.Runloop = Runloop;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        Streams.CLOSE_SENTINEL = Symbol('close-sentinel');
        Streams.START_SENTINEL = Symbol('start-sentinel');
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class StateMachine {
            constructor(resolved) {
                this.state = this.reset();
            }
            get current() {
                return this.state;
            }
            setStaging() {
                this.state = this.reset();
            }
            setStaged(v) {
                var _a;
                (_a = this.resolve) === null || _a === void 0 ? void 0 : _a.call(this, v);
                delete this.resolve;
            }
            setFailed(e) {
                var _a;
                (_a = this.reject) === null || _a === void 0 ? void 0 : _a.call(this, e);
                // this.state = Promise.reject(e)
                // this.state.catch(NO_OP)
                delete this.reject;
            }
            reset() {
                if (this.resolve && this.reject) {
                    return this.state;
                }
                return WHATWG.HANDLED(new Promise((resolve, reject) => {
                    this.resolve = resolve;
                    this.reject = reject;
                }));
            }
        }
        Streams.StateMachine = StateMachine;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class Stream {
            constructor(strategy) {
                this.strategy = strategy;
                this.queue = new Streams.Queue(this.strategy);
                this._closing = false;
                this._erroring = false;
            }
            enqueue(item) {
                this.queue.put(item);
            }
            dequeue() {
                return this.queue.take();
            }
            unshift(item) {
                this.queue.unshift(item);
            }
            peek() {
                return this.queue.peek();
            }
            get desiredSize() {
                return this.queue.desiredSize;
            }
            get thresholdSize() {
                return this.queue.thresholdSize;
            }
            get closing() {
                return this._closing;
            }
            close() {
                this._closing = true;
            }
            get erroring() {
                return this._erroring;
            }
            error() {
                this._erroring = true;
            }
            reset() {
                this.queue.reset();
            }
            get empty() {
                return this.queue.empty;
            }
            get drained() {
                return this.queue.empty && this.closing;
            }
        }
        Streams.Stream = Stream;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class StreamConsumer extends Streams.Runloop {
            constructor(stream) {
                super();
                this.stream = stream;
                this.closedState = new Streams.ClosedState(this);
            }
            didInstall(host) {
            }
            willUninstall(host) {
                this.closedState.setStaging();
                this.closedState.setFailed(new TypeError());
            }
            get closed() {
                return this.closedState.current;
            }
            next() {
                this.resume();
            }
            /** @override */
            shouldExit() {
                return this.stream.drained;
            }
            /** @override */
            shouldYield() {
                return this.stream.empty || this.stream.thresholdSize >= 0 && !this.stream.closing;
            }
        }
        Streams.StreamConsumer = StreamConsumer;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class StreamProducer extends Streams.Runloop {
            constructor(stream) {
                super();
                this.stream = stream;
                this.closedState = new Streams.ClosedState(this);
                this.erroring = false;
            }
            didInstall(host) {
            }
            willUninstall(host) {
            }
            get desiredSize() {
                if (this.erroring) {
                    return null;
                }
                if (this.stream.drained) {
                    return 0;
                }
                return this.stream.desiredSize;
            }
            next() {
                this.resume();
            }
            /** @override */
            error(reason) {
                this.erroring = true;
                return super.error(reason);
            }
            /** @override */
            shouldExit() {
                return this.stream.closing;
            }
            /** @override */
            shouldYield() {
                return this.stream.desiredSize <= 0;
            }
        }
        Streams.StreamProducer = StreamProducer;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class RunloopStateMachine extends Streams.StateMachine {
            constructor(runloop) {
                super();
                this.runloop = runloop;
                this._observer = this.observer.bind(this);
                this.setup();
            }
            setup() {
                const states = this.statesToObserve;
                try {
                    const r = this.runloop.addObserver(states, this._observer);
                    if (!r) {
                        this.observer(Streams.RunloopState.Stopped | Streams.RunloopState.Finished);
                    }
                }
                catch (e) {
                    this.observer(Streams.RunloopState.Errored, e);
                }
            }
            destroy() {
                // const states = this.statesToObserve
                // this.runloop.removeObserver(states, this._observer)
            }
        }
        class ClosedState extends RunloopStateMachine {
            constructor(runloop, early = false) {
                super(runloop);
                this.runloop = runloop;
                this.early = early;
            }
            get statesToObserve() {
                return Streams.RunloopState.Terminated;
            }
            observer(state, error) {
                if ((state & Streams.RunloopState.Running) && !this.early) {
                    return;
                }
                if (state & Streams.RunloopState.Errored) {
                    this.setFailed(error);
                }
                else if (state & Streams.RunloopState.Terminated) {
                    this.setStaged();
                }
            }
        }
        Streams.ClosedState = ClosedState;
        class ReadyState extends RunloopStateMachine {
            get statesToObserve() {
                return Streams.RunloopState.All;
            }
            observer(state, error) {
                if (state & Streams.RunloopState.Errored) {
                    this.setFailed(error);
                }
                else if (state & Streams.RunloopState.Terminated) {
                    this.setStaged();
                }
                else if (state & Streams.RunloopState.Waiting) {
                    this.setStaging();
                }
                else {
                    this.setStaged();
                }
            }
        }
        Streams.ReadyState = ReadyState;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    function assert(condition, message) {
        if (!condition) {
            const error = message instanceof Error ? message : new Error(message);
            error.name = 'AssertionError';
            if (typeof Error.captureStackTrace === 'function') {
                Error.captureStackTrace(error, assert);
            }
            throw error;
        }
    }
    WHATWG.assert = assert;
    function guard(condition, message) {
        if (!condition) {
            const error = message instanceof Error ? message : new TypeError(message);
            if (typeof Error.captureStackTrace === 'function') {
                Error.captureStackTrace(error, guard);
            }
            throw error;
        }
    }
    WHATWG.guard = guard;
    function assertUnreached(message) {
        const error = message instanceof Error ? message : new Error(message);
        error.name = 'AssertionError';
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(error, assertUnreached);
        }
        throw error;
    }
    WHATWG.assertUnreached = assertUnreached;
    WHATWG.ASSERT = assert;
    WHATWG.GUARD = guard;
    function NO_OP(...args) { }
    WHATWG.NO_OP = NO_OP;
    function DEFER(callback) {
        return HANDLED(Promise.resolve().then(callback));
    }
    WHATWG.DEFER = DEFER;
    function REJECTION(error) {
        return HANDLED(Promise.reject(error));
    }
    WHATWG.REJECTION = REJECTION;
    WHATWG.DEFER_ERROR = REJECTION;
    function HANDLED(p) {
        const r = p instanceof Promise ? p : new Promise(p.then.bind(p));
        r.then(NO_OP, NO_OP);
        return r;
    }
    WHATWG.HANDLED = HANDLED;
    function FIRST(...args) {
        return args[0];
    }
    WHATWG.FIRST = FIRST;
    function LAST(...args) {
        return args[args.length - 1];
    }
    WHATWG.LAST = LAST;
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class ReadableStream extends Streams.Stream {
            constructor(init, strategy) {
                super(strategy);
                const source = Streams.UnderlyingSource.normalize(init);
                const controller = new Streams.ReadableStreamDefaultController(this);
                this.installProducer(source, controller);
            }
            cancel(reason) {
                if (this.consumer) {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                return this.producer.cancel(reason);
            }
            getReader(options = {}) {
                WHATWG.guard(typeof options === 'object' || typeof options === 'function');
                WHATWG.guard(typeof options.mode === 'undefined' || String(options.mode) === 'byob');
                WHATWG.guard(!this.locked);
                // readable bytes stream not supported yet
                WHATWG.guard(typeof options.mode === 'undefined');
                return new Streams.ReadableStreamDefaultReader(this);
            }
            getController() {
                const controller = new Streams.ReadableStreamDefaultController(this);
                return controller;
            }
            installProducer(source, controller) {
                WHATWG.guard(!this.producer);
                this.producer = new Streams.ReadableStreamProducer(this, source, controller);
                this.producer.didInstall(this);
            }
            installConsumer() {
                WHATWG.guard(!this.consumer);
                this.consumer = new Streams.ReadableStreamConsumer(this);
                this.consumer.didInstall(this);
            }
            uninstallProducer() {
                WHATWG.guard(!!this.producer);
                this.producer.willUninstall(this);
                this.producer = undefined;
            }
            uninstallConsumer() {
                WHATWG.guard(!!this.consumer);
                this.consumer.willUninstall(this);
                this.consumer = undefined;
            }
            get locked() {
                return typeof this.consumer !== 'undefined' && typeof this.producer !== 'undefined';
            }
        }
        Streams.ReadableStream = ReadableStream;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
/// <reference path="ReadableStream.ts" />
var WHATWG;
/// <reference path="ReadableStream.ts" />
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        Streams.ReadableStream.prototype.tee = function () {
            const stream = this;
            const reader = stream.getReader();
            let reading = false;
            const reasons = [undefined, undefined];
            const canceleds = [false, false];
            const controllers = [];
            const canceledState = new Streams.StateMachine();
            const source = {
                start(controller) {
                    controllers.push(controller);
                },
                pull(controller) {
                    if (reading) {
                        return Promise.resolve();
                    }
                    reading = true;
                    reader.read().then(helpers.onRead, helpers.onReadEnd);
                    return Promise.resolve();
                },
                type: undefined,
            };
            const helpers = {
                onRead({ done, value: chunk }) {
                    if (!done) {
                        // queueMicrotask
                        // HANDLED(Promise.resolve().then(() => {
                        helpers.onReadEnd();
                        helpers.enqueueAll(chunk);
                        // }))
                    }
                    else {
                        helpers.onReadEnd();
                        helpers.closeAll();
                    }
                },
                onReadEnd() {
                    reading = false;
                },
                enqueueAll(chunk) {
                    for (let i = 0; i < controllers.length; i++) {
                        if (!canceleds[i]) {
                            const branch = branches[i];
                            if (!branch.closing && !branch.erroring) {
                                try {
                                    controllers[i].enqueue(chunk);
                                }
                                catch (e) { }
                            }
                        }
                    }
                },
                closeAll() {
                    for (let i = 0; i < controllers.length; i++) {
                        if (!canceleds[i]) {
                            const branch = branches[i];
                            if (!branch.closing && !branch.erroring) {
                                try {
                                    controllers[i].close();
                                }
                                catch (e) { }
                            }
                        }
                    }
                    canceledState.setStaged();
                },
                errorAll(reason) {
                    for (let i = 0; i < controllers.length; i++) {
                        controllers[i].error(reason);
                    }
                },
                makeCancelHook(i) {
                    return (reason) => {
                        canceleds[i] = true;
                        reasons[i] = reason;
                        if (canceleds.every(r => r)) {
                            const canceled = stream['producer'].cancel(reasons);
                            canceledState.setStaged(canceled);
                        }
                        return canceledState.current;
                    };
                }
            };
            const branches = [
                new Streams.ReadableStream(Object.assign(Object.assign({}, source), { cancel: helpers.makeCancelHook(0) })),
                new Streams.ReadableStream(Object.assign(Object.assign({}, source), { cancel: helpers.makeCancelHook(1) })),
            ];
            reader.closed.catch((r) => {
                helpers.errorAll(r);
                canceledState.setStaged();
            });
            return branches;
        };
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class ReadableStreamConsumer extends Streams.StreamConsumer {
            constructor() {
                super(...arguments);
                this.closedState = new Streams.ClosedState(this, true);
            }
            /** @override */
            next() {
                return WHATWG.HANDLED(new Promise((resolve, reject) => {
                    const request = {
                        next: () => {
                            const chunk = this.stream.dequeue();
                            resolve({ done: false, value: chunk });
                        },
                        done: () => {
                            resolve({ done: true, value: undefined });
                        },
                        error: (e) => {
                            reject(e);
                        },
                        name: 'read'
                    };
                    try {
                        const r = this.enqueueRequest(request);
                        if (!r) {
                            request.done();
                        }
                    }
                    catch (e) {
                        request.error(e);
                    }
                }));
            }
        }
        Streams.ReadableStreamConsumer = ReadableStreamConsumer;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class ReadableStreamDefaultController {
            constructor(stream) {
                this.stream = stream;
                WHATWG.guard(stream instanceof Streams.ReadableStream);
                WHATWG.guard(!stream.locked);
            }
            get producer() {
                return this.stream['producer'];
            }
            get consumer() {
                return this.stream['consumer'];
            }
            get desiredSize() {
                return this.producer.desiredSize;
            }
            /** @throws */
            enqueue(chunk) {
                var _a;
                try {
                    WHATWG.guard(!this.stream.closing && !this.stream.erroring);
                    this.stream.enqueue(chunk);
                }
                catch (e) {
                    this.error(e);
                    throw e;
                }
                (_a = this.consumer) === null || _a === void 0 ? void 0 : _a.resume();
                this.producer.next();
            }
            /** @throws */
            close() {
                var _a;
                try {
                    WHATWG.guard(!this.stream.closing && !this.stream.erroring);
                    this.stream.close();
                }
                catch (e) {
                    this.error(e);
                    throw e;
                }
                this.producer.stop();
                (_a = this.consumer) === null || _a === void 0 ? void 0 : _a.resume();
            }
            /** safe to error more than one times */
            error(reason) {
                var _a;
                this.stream.error();
                this.producer.error(reason);
                (_a = this.consumer) === null || _a === void 0 ? void 0 : _a.error(reason);
            }
        }
        Streams.ReadableStreamDefaultController = ReadableStreamDefaultController;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class ReadableStreamDefaultReader {
            constructor(stream) {
                this.stream = stream;
                WHATWG.guard(stream instanceof Streams.ReadableStream);
                WHATWG.guard(!stream.locked);
                this.setup();
            }
            setup() {
                this.stream.installConsumer();
                this.consumer = this.stream['consumer'];
                this.producer = this.stream['producer'];
                WHATWG.assert(typeof this.consumer !== 'undefined');
                WHATWG.assert(typeof this.producer !== 'undefined');
                try {
                    this.producer.resume();
                    this.consumer.resume();
                }
                catch (e) {
                    // error the consumer if the producer already errored
                    this.consumer.error(e);
                }
            }
            teardown() {
                this.stream.uninstallConsumer();
                // keep consumer reference
            }
            get closed() {
                return this.consumer.closed;
            }
            cancel(reason) {
                if (this.consumer !== this.stream['consumer']) {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                return WHATWG.FIRST(this.producer.cancel(reason), this.consumer.stop());
            }
            releaseLock() {
                if (!this.stream.locked) {
                    return;
                }
                if (this.consumer !== this.stream['consumer']) {
                    return;
                }
                this.teardown();
            }
            read() {
                const r = this.consumer.next();
                this.syncReadState(r);
                this.producer.next();
                return WHATWG.HANDLED(r);
            }
            syncReadState(when) {
                if (when && when instanceof Promise) {
                    WHATWG.HANDLED(when.then(() => { this.producer.forcedPull = !this.consumer.idle; }));
                }
                this.producer.forcedPull = !this.consumer.idle;
            }
        }
        Streams.ReadableStreamDefaultReader = ReadableStreamDefaultReader;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        const MAX_PULLS_INFLIGHT = 2;
        class ReadableStreamProducer extends Streams.StreamProducer {
            constructor(stream, source, controller) {
                super(stream);
                this.stream = stream;
                this.source = source;
                this.controller = controller;
                this.started = false;
                this.pulls = 0;
                this.forced = false;
            }
            /** @override */
            didInstall(host) {
                super.didInstall(host);
                this.start();
            }
            start() {
                WHATWG.assert(!!this.source && !!this.controller);
                WHATWG.HANDLED(this.source.start(this.controller).then(() => {
                    // if (this.stream.closing || this.stream.erroring) {
                    //   return
                    // }
                    this.started = true;
                    this.next();
                }));
            }
            next() {
                if (!this.started || this.pulls >= MAX_PULLS_INFLIGHT || this.shouldYield()) {
                    return;
                }
                this.pulls += 1;
                try {
                    this.enqueueRequest({
                        next: () => {
                            const r = this.source.pull(this.controller);
                            WHATWG.HANDLED(r.finally(() => { this.pulls -= 1; }));
                            return r;
                        },
                        name: 'pull'
                    });
                }
                catch (e) {
                    // this.pulls -= 1
                }
            }
            cancel(reason) {
                WHATWG.guard(typeof this.stream !== 'undefined');
                if (this.stream.drained || this.stream.erroring) {
                    return Promise.resolve();
                }
                if (!this.stream.closing) {
                    this.controller.close();
                }
                this.stream.reset();
                WHATWG.assert(this.stream.drained);
                return this.source.cancel(reason);
            }
            set forcedPull(forced) {
                this.forced = forced;
            }
            /** @override */
            shouldYield() {
                return !this.forced && super.shouldYield();
            }
        }
        Streams.ReadableStreamProducer = ReadableStreamProducer;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        let UnderlyingSource;
        (function (UnderlyingSource) {
            function normalize(source) {
                WHATWG.guard(source !== null);
                const { start, pull, cancel, type } = source !== null && source !== void 0 ? source : { type: undefined };
                WHATWG.guard(typeof start === 'undefined' || typeof start === 'function');
                WHATWG.guard(typeof pull === 'undefined' || typeof pull === 'function');
                WHATWG.guard(typeof cancel === 'undefined' || typeof cancel === 'function');
                WHATWG.guard(typeof type === 'undefined' || String(type) === 'bytes');
                return {
                    /**
                     * execute or throws
                     * @throws @rejection_handled
                     */
                    start(controller) {
                        const r = start && Reflect.apply(start, source, [controller]);
                        if (r && r instanceof Promise) {
                            r.catch(e => controller.error(e));
                        }
                        return Promise.resolve(r);
                    },
                    /**
                     * execute or defer error
                     * @rejection_handled
                     */
                    pull(controller) {
                        try {
                            const r = pull && Reflect.apply(pull, source, [controller]);
                            if (r && r instanceof Promise) {
                                r.catch(e => controller.error(e));
                            }
                            return Promise.resolve(r);
                        }
                        catch (e) {
                            return WHATWG.DEFER(() => {
                                controller.error(e);
                                throw e;
                            });
                        }
                    },
                    /**
                     * execute
                     * @rejection_handled
                     */
                    cancel(reason) {
                        try {
                            const r = cancel && Reflect.apply(cancel, source, [reason]);
                            if (r && r instanceof Promise) {
                                // ensure the return type is Promise<void>
                                return WHATWG.HANDLED(r.then(WHATWG.NO_OP));
                            }
                            return Promise.resolve();
                        }
                        catch (e) {
                            return WHATWG.HANDLED(Promise.reject(e));
                        }
                    },
                    type,
                };
            }
            UnderlyingSource.normalize = normalize;
            UnderlyingSource.from = normalize;
        })(UnderlyingSource = Streams.UnderlyingSource || (Streams.UnderlyingSource = {}));
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        let UnderlyingSink;
        (function (UnderlyingSink) {
            function normalize(sink) {
                WHATWG.guard(sink !== null);
                const { start, write, close, abort } = sink !== null && sink !== void 0 ? sink : {};
                WHATWG.guard(typeof start === 'undefined' || typeof start === 'function');
                WHATWG.guard(typeof write === 'undefined' || typeof write === 'function');
                WHATWG.guard(typeof close === 'undefined' || typeof close === 'function');
                WHATWG.guard(typeof abort === 'undefined' || typeof abort === 'function');
                return {
                    /**
                     * execute or throws
                     * @throws @rejection_handled
                     */
                    start(controller) {
                        let r = start && Reflect.apply(start, sink, [controller]);
                        if (r && typeof r.then === 'function') {
                            if (!(r instanceof Promise)) {
                                r = new Promise(r.then.bind(r));
                            }
                            // ensure return as Promise<void>
                            return WHATWG.HANDLED(r.then(WHATWG.NO_OP, (e) => {
                                controller.error(e);
                                throw e;
                            }));
                        }
                        return Promise.resolve();
                    },
                    /**
                     * execute or error
                     * @rejection_handled
                     */
                    write(chunk, controller) {
                        try {
                            let r = write && Reflect.apply(write, sink, [chunk, controller]);
                            if (r && typeof r.then === 'function') {
                                if (!(r instanceof Promise)) {
                                    r = new Promise(r.then.bind(r));
                                }
                                // ensure return as Promise<void>
                                return WHATWG.HANDLED(r.then(WHATWG.NO_OP, (e) => {
                                    controller.error(e);
                                    throw e;
                                }));
                            }
                            return Promise.resolve();
                        }
                        catch (e) {
                            return WHATWG.DEFER(() => {
                                controller.error(e);
                                throw e;
                            });
                        }
                    },
                    /**
                     * execute or error
                     * @rejection_handled
                     * @deprecated_paramter controller
                     */
                    close(controller) {
                        try {
                            let r = close && Reflect.apply(close, sink, [ /*controller*/]);
                            if (r && typeof r.then === 'function') {
                                // ensure return as Promise<void>
                                if (!(r instanceof Promise)) {
                                    r = new Promise(r.then.bind(r));
                                }
                                // ensure return as Promise<void>
                                return WHATWG.HANDLED(r.then(WHATWG.NO_OP, (e) => {
                                    controller.error(e);
                                    throw e;
                                }));
                            }
                            return Promise.resolve();
                        }
                        catch (e) {
                            return WHATWG.DEFER(() => {
                                controller.error(e);
                                throw e;
                            });
                        }
                    },
                    /**
                     * execute
                     * @rejection_handled
                     */
                    abort(reason) {
                        try {
                            let r = abort && Reflect.apply(abort, sink, [reason]);
                            if (r && typeof r.then === 'function') {
                                if (!(r instanceof Promise)) {
                                    r = new Promise(r.then.bind(r));
                                }
                                // ensure return as Promise<void>
                                return WHATWG.HANDLED(r.then(WHATWG.NO_OP));
                            }
                            return Promise.resolve();
                        }
                        catch (e) {
                            return WHATWG.HANDLED(Promise.reject(e));
                        }
                    },
                };
            }
            UnderlyingSink.normalize = normalize;
            UnderlyingSink.from = normalize;
        })(UnderlyingSink = Streams.UnderlyingSink || (Streams.UnderlyingSink = {}));
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class WritableStream extends Streams.Stream {
            constructor(init, strategy) {
                super(strategy);
                const sink = Streams.UnderlyingSink.normalize(init);
                const controller = new Streams.WritableStreamDefaultController(this);
                this.installConsumer(sink, controller);
            }
            getWriter() {
                WHATWG.guard(!this.locked);
                return new Streams.WritableStreamDefaultWriter(this);
            }
            installConsumer(sink, controller) {
                WHATWG.guard(!this.consumer);
                this.consumer = new Streams.WritableStreamConsumer(this, sink, controller);
                this.consumer.didInstall(this);
            }
            installProducer() {
                WHATWG.guard(!this.producer);
                this.producer = new Streams.WritableStreamProducer(this);
                this.producer.didInstall(this);
            }
            uninstallConsumer() {
                WHATWG.guard(!!this.consumer);
                this.consumer.willUninstall(this);
                this.consumer = undefined;
            }
            uninstallProducer(data) {
                WHATWG.guard(!!this.producer);
                this.producer.willUninstall(this, data);
                this.producer = undefined;
            }
            abort(reason) {
                if (typeof this.producer !== 'undefined') {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                return this.consumer.abort(reason);
            }
            /** @override */
            close() {
                if (typeof this.producer !== 'undefined') {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                try {
                    WHATWG.guard(!this.closing);
                    this.enqueue(Streams.CLOSE_SENTINEL);
                    super.close();
                }
                catch (e) {
                    return WHATWG.HANDLED(Promise.reject(e));
                }
                return this.consumer.next('close');
            }
            get locked() {
                return typeof this.producer !== 'undefined' && typeof this.consumer !== 'undefined';
            }
        }
        Streams.WritableStream = WritableStream;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class WritableStreamConsumer extends Streams.StreamConsumer {
            constructor(stream, sink, controller) {
                super(stream);
                this.stream = stream;
                this.sink = sink;
                this.controller = controller;
                this.starting = false;
                this.started = false;
                this.erroring = false;
                this.errored = false;
                this.finished = false;
                this.abortedUnexpectedly = false;
            }
            /** @override */
            didInstall(host) {
                super.didInstall(host);
                this.start();
            }
            /** @throws */
            start() {
                let thrown = false;
                let errorThrown;
                this.enqueueRequest({
                    next: () => {
                        try {
                            const r = this.sink.start(this.controller);
                            WHATWG.HANDLED(r.finally(() => this.started = true));
                            return r;
                        }
                        catch (e) {
                            thrown = true;
                            errorThrown = e;
                            throw e; // rethrow to break the runloop
                        }
                    },
                    name: 'start'
                });
                this.starting = true;
                // bubbles error outside
                if (thrown) {
                    throw errorThrown;
                }
            }
            /** @throws */
            start0() {
                const r = this.sink.start(this.controller);
                WHATWG.HANDLED(r.finally(() => this.started = true));
                WHATWG.HANDLED(r.then(() => this.resume()));
            }
            next(name) {
                return WHATWG.HANDLED(new Promise((resolve, reject) => {
                    const request = {
                        next: () => {
                            const chunk = this.stream.peek();
                            if (chunk !== Streams.CLOSE_SENTINEL) {
                                const r = this.sink.write(chunk, this.controller);
                                r.then(resolve, reject);
                                WHATWG.HANDLED(r.finally(() => this.stream.dequeue()));
                                return r;
                            }
                            else {
                                this.stream.dequeue();
                                WHATWG.assert(this.stream.empty);
                                const r = this.sink.close(this.controller);
                                r.then(resolve, reject);
                                r.catch(e => {
                                    this.abortedUnexpectedly = true;
                                    this.abortedErrorUnexpectedly = e;
                                });
                                WHATWG.HANDLED(r.then(() => this.finished = true));
                                return r;
                            }
                        },
                        done: WHATWG.assertUnreached,
                        error: (e) => {
                            this.stream.reset();
                            reject(e);
                        },
                        name,
                    };
                    // throw-safe
                    try {
                        const r = this.enqueueRequest(request);
                        // guard(r)
                        if (!r) {
                            reject(new TypeError());
                        }
                    }
                    catch (e) {
                        /** @todo distinguish between write and close request in a better way then by name */
                        if (request.name === 'close') {
                            reject(new TypeError());
                        }
                        else {
                            reject(e);
                        }
                    }
                }));
            }
            /** disable stop */
            /** @override */
            stop(reason) {
                return false;
            }
            abort(reason) {
                var _a;
                WHATWG.guard(typeof this.stream !== 'undefined');
                let alreadyErroring = false;
                const r = (_a = this.abortedPromise) !== null && _a !== void 0 ? _a : (this.abortedPromise = WHATWG.HANDLED(new Promise((resolve, reject) => {
                    let terminated = true;
                    try {
                        terminated = !this.enqueueRequest({
                            next: WHATWG.assertUnreached,
                            done: () => {
                                this.abortedPromise = undefined;
                                resolve();
                            },
                            error: e => {
                                this.abortedPromise = undefined;
                                if (this.abortedUnexpectedly) {
                                    reject(this.abortedErrorUnexpectedly);
                                }
                                else if (alreadyErroring) {
                                    reject(e);
                                }
                                else {
                                    const r = this.sink.abort(e);
                                    r.then(resolve, reject);
                                    return r;
                                }
                            },
                            name: 'abort'
                        });
                    }
                    catch (e) { }
                    finally {
                        if (terminated) {
                            resolve();
                        }
                    }
                })));
                if (!this.error(reason)) {
                    alreadyErroring = true;
                }
                return r;
            }
            /** @override */
            shouldYield() {
                // no waiting before starting
                if (!this.starting) {
                    return false;
                }
                return super.shouldYield();
            }
        }
        Streams.WritableStreamConsumer = WritableStreamConsumer;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class WritableStreamDefaultController {
            constructor(stream) {
                this.stream = stream;
                WHATWG.guard(stream instanceof Streams.WritableStream);
                WHATWG.guard(!stream.locked);
                WHATWG.guard(!this.consumer);
            }
            get producer() {
                return this.stream['producer'];
            }
            get consumer() {
                return this.stream['consumer'];
            }
            error(reason) {
                var _a;
                const canPropagateError = this.consumer.error(reason);
                if (canPropagateError) {
                    (_a = this.producer) === null || _a === void 0 ? void 0 : _a.error(reason);
                }
            }
        }
        Streams.WritableStreamDefaultController = WritableStreamDefaultController;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class WritableStreamDefaultWriter {
            constructor(stream) {
                this.stream = stream;
                this.closedState = new Streams.StateMachine();
                WHATWG.guard(stream instanceof Streams.WritableStream);
                WHATWG.guard(!stream.locked);
                this.setup();
            }
            setup() {
                this.stream.installProducer();
                this.consumer = this.stream['consumer'];
                this.producer = this.stream['producer'];
                WHATWG.assert(typeof this.consumer !== 'undefined');
                WHATWG.assert(typeof this.producer !== 'undefined');
                this.syncClosedState();
                // propagate state from the consumer to the new producder
                try {
                    const closed = !this.consumer.resume();
                    if (closed) {
                        this.producer.stop();
                    }
                    else {
                        this.producer.resume();
                    }
                }
                catch (e) {
                    // error the producer if the consumer erroring
                    this.producer.error(e);
                }
            }
            teardown() {
                const reason = new TypeError();
                // uninstall yet keep producer reference
                this.stream.uninstallProducer(reason);
                // force to set failed
                this.closedState.setStaging();
                this.closedState.setFailed(reason);
            }
            releaseLock() {
                if (!this.stream.locked) {
                    return;
                }
                if (this.producer !== this.stream['producer']) {
                    return;
                }
                this.teardown();
            }
            get closed() {
                return this.closedState.current;
            }
            get ready() {
                return this.producer.ready;
            }
            get desiredSize() {
                WHATWG.guard(this.producer === this.stream['producer']);
                if (!this.consumer['finished'] && this.stream.closing) {
                    return this.stream.desiredSize;
                }
                return this.producer.desiredSize;
            }
            write(chunk) {
                if (this.producer !== this.stream['producer']) {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                try {
                    // pre-check whether consumer erroring
                    this.consumer.resume();
                    this.producer.next(chunk);
                }
                catch (e) {
                    this.producer.error(e);
                    this.consumer.error(e);
                    return WHATWG.HANDLED(Promise.reject(e));
                }
                const r = this.consumer.next('write');
                WHATWG.HANDLED(r.then(() => this.producer.resume()));
                return r;
            }
            close() {
                if (this.producer !== this.stream['producer']) {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                try {
                    this.producer.stop();
                }
                catch (e) {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                return this.consumer.next('close');
            }
            abort(reason) {
                if (this.producer !== this.stream['producer']) {
                    return WHATWG.HANDLED(Promise.reject(new TypeError()));
                }
                return WHATWG.LAST(this.producer.error(reason), this.consumer.abort(reason));
            }
            syncClosedState() {
                this.consumer.closed.then(() => this.closedState.setStaged(), r => this.closedState.setFailed(r));
            }
        }
        Streams.WritableStreamDefaultWriter = WritableStreamDefaultWriter;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
var WHATWG;
(function (WHATWG) {
    var Streams;
    (function (Streams) {
        class WritableStreamProducer extends Streams.StreamProducer {
            constructor() {
                super(...arguments);
                this.readyState = new Streams.StateMachine();
                this.closing = false;
            }
            /** @override */
            didInstall(host) {
                super.didInstall(host);
                this.resume();
            }
            /** @override */
            willUninstall(host, reserved) {
                this.readyState.setStaging();
                this.readyState.setFailed(reserved !== null && reserved !== void 0 ? reserved : new TypeError());
                super.willUninstall(host);
            }
            get ready() {
                return this.readyState.current;
            }
            /** @override */
            resume() {
                if (this.desiredSize === null) {
                    this.readyState.setFailed();
                    return false;
                }
                if (this.desiredSize > 0 || this.closing) {
                    this.readyState.setStaged();
                    return true;
                }
                this.readyState.setStaging();
                return false;
            }
            /** @override @throws */
            next(chunk) {
                WHATWG.guard(!this.closing);
                this.stream.enqueue(chunk);
                this.resume();
            }
            /** @override @throws */
            stop() {
                WHATWG.guard(!this.closing);
                if (this.erroring) {
                    return false;
                }
                this.closing = true;
                if (!this.stream.closing) {
                    this.stream.enqueue(Streams.CLOSE_SENTINEL);
                    Reflect.apply(Streams.Stream.prototype.close, this.stream, []);
                    // this.stream.close()
                }
                this.readyState.setStaged();
                return true;
            }
            /** @overrde */
            error(reason) {
                const r = super.error(reason);
                if (r) {
                    WHATWG.assert(this.erroring);
                    this.caughtError = reason;
                    // forcedly set failed
                    this.readyState.setStaging();
                    this.readyState.setFailed(reason);
                }
                return r;
            }
        }
        Streams.WritableStreamProducer = WritableStreamProducer;
    })(Streams = WHATWG.Streams || (WHATWG.Streams = {}));
})(WHATWG || (WHATWG = {}));
