export class EventEmitter {
	constructor() {
		this.events = {};
	}
	on(event, listener) {
		if (!this.events[event]) this.events[event] = [];
		this.events[event].push(listener);
		return this;
	}
	once(event, listener) {
		const wrapper = (...args) => {
			this.off(event, wrapper);
			listener.apply(this, args);
		};
		return this.on(event, wrapper);
	}
	emit(event, ...args) {
		if (!this.events[event]) return false;
		for (const listener of this.events[event]) {
			listener.apply(this, args);
		}
		return true;
	}
	off(event, listener) {
		if (!this.events[event]) return this;
		this.events[event] = this.events[event].filter((l) => l !== listener);
		return this;
	}
	addListener(event, listener) {
		return this.on(event, listener);
	}
	removeListener(event, listener) {
		return this.off(event, listener);
	}
	removeAllListeners(event) {
		if (event) {
			delete this.events[event];
		} else {
			this.events = {};
		}
		return this;
	}
	listenerCount(event) {
		return this.events[event] ? this.events[event].length : 0;
	}
}

export default { EventEmitter };
