/**
 * @typedef {"badInput"|"customError"|"patternMismatch"|"rangeOverflow"|"rangeUnderflow"|"stepMismatch"|"tooLong"|"tooShort"|"typeMismatch"|"valid"|"valueMissing"} ValidityConstraint
 */

/**
 * @template Result
 * @typedef {((arr: TemplateStringsArray, ...params: String[])=>Result) & ((string: String)=>Result)} Template
 */

class StateAttributeSet {
	/** @type {HTMLElement} */
	#element

	/** @type {Set<String>} */
	#states

	/**
	 * @param {HTMLElement} element
	 * @param {Set<String>} states
	 */
	constructor(element, states) {
		try { states.add("supports-states") }
		catch { states = new Set() }

		this.#element = element
		this.#states = states
	}

	/** @param {String} state */
	add(state) {
		this.#element.setAttribute(state, "")
		this.#states.add(state)
	}

	/** @param {String} state */
	delete(state) {
		this.#element.removeAttribute(state)
		this.#states.delete(state)
	}

	/** @param {String} state */
	has(state) {
		return this.#states.has(state)
	}

	/**
	 * @param {String} state
	 * @param {[]|[any]} force
	 */
	toggle(state, ...force) {
		if (!force) {
			force = [!this.#states.has(state)]
		}
		if (force[0]) {
			this.#states.add(state)
		} else {
			this.#states.delete(state)
		}
		this.#element.toggleAttribute(state, this.#states.has(state))
	}
}

/**
 * @template Type
 * @param {(string: String)=>Type} fn
 * @return {Template<Type>}
 */
const template = fn => {
	/**
	 * @param {String|TemplateStringsArray} arr
	 * @param {String[]} params
	 */
	return (arr, ...params) => {
		if (arr instanceof Array) {
			const buffer = []
			for (let i = 0; i < params.length; i++) {
				buffer.push(arr[i])
				buffer.push(params[i])
			}
			buffer.push(arr[arr.length - 1])
			return fn(buffer.join(""))
		}
		return fn(arr)
	}
}

/** Outwards iterator over an element's root nodes across shadow DOM boundaries
 * @param {Element} element
 */
const ancestorRoots = function*(element) {
	while (true) {
		const root = element.getRootNode()
		yield {root,element}
		if (root instanceof ShadowRoot) {
			element = root.host
		} else {
			break
		}
	}
}

const f = template(string => {
	const template = document.createElement("template")
	template.innerHTML = string
	return template.content
})

const css = template(string => {
	const styleSheet = new CSSStyleSheet
	styleSheet.replaceSync(string)
	return styleSheet
})

const childObserver = new MutationObserver(mutations => {
	const targets = new Set()
	for (const {target} of mutations) {
		if (target instanceof BetterSelect)
			targets.add(target)
	}
	for (const target of targets)
		target.mutationCallback()
})

export class BetterSelect extends HTMLElement {
	/** @type {AbortController} */
	#abortOpen
	#value = {}

	#internals = this.attachInternals()
	#states = new StateAttributeSet(this, this.#internals.states)

	static formAssociated = true
	static observedAttributes = Object.freeze(["placeholder", "search-placeholder", "required"])

	static styleSheet = css`
		:host {
			position: relative;
			display: inline-block;
		}
		* {
			box-sizing: border-box;
		}
		[part="display"] {
			min-width: 100%;

			/* Layout */
			align-items: center;
			display: inline-flex;
			flex-flow: row nowrap;

			/* Styling */
			cursor: pointer;
		}
		[part="display-text"]:empty {
			display: none;
		}
		:not(#text:empty + *)[name="placeholder"] {
			display: none;
		}
		#text:empty ~ *[name="clear"] {
			display: none;
		}
		[part="drop-down"], [part="item"] {
			/* Resets */
			border: unset;
			outline: unset;
			padding: unset;
		}
		[part="drop-down"] {
			background: inherit;
			color: inherit;

			position: absolute;
			flex-flow: column;
			margin: 0;
			z-index: var(--layer-dropdown, 100);
		}
		[part="drop-down"]:modal {
			margin: auto;
			&::backdrop {
				background-color: #fff2;
				backdrop-filter: blur(2px);
			}
		}
		[part="drop-down"][open] {
			display: flex;
		}
		[part="list"] {
			display: contents;
		}
		[part~="item"] {
			display: block;
			white-space: nowrap;
			&[part~="enabled"] {
				cursor: pointer;
			}
		}
		[part="item"]:focus {
			font-weight: bold;
		}
		[part="item"][hidden] {
			display: none;
		}
		slot[name="loading"] {
			display: none;
		}
		:host(:state(loading)) {
			[part="list"] { display: none; }
			slot[name="loading"] { display: block; }
		}
		slot[name="clear"] > button {
			all: unset;
			transform: rotate(45deg);
			&::after {
				content: "+";
			}
		}
	`

	/** @type {HTMLElement} */
	display
	/** @type {HTMLElement} */
	text
	/** @type {HTMLElement} */
	list
	/** @type {HTMLElement} */
	placeholder
	/** @type {HTMLInputElement} */
	input
	/** @type {HTMLDialogElement} */
	dialog
	/** @type {HTMLDialogElement} */
	loading

	constructor() {
		super()

		childObserver.observe(this, {childList: true})
		this.attachShadow({mode: "open"}).innerHTML = `
			<div id="display" part="display">
				<span part="display-text" id="text"></span>
				<slot part="placeholder" name="placeholder" aria-hidden="true">
					<span id="placeholder" aria-hidden="true"></span>
				</slot>
				<template id="clear-template">
					<slot name="clear" part="clear">
						<button></button>
					</slot>
				</template>
			</div>
			<dialog id="dialog" part="drop-down">
				<slot name="top"></slot>
				<input type="search" id="input" part="search" type="search"></input>
				<slot name="below-search"></slot>
				<ul id="list" part="list"></ul>
				<slot name="bottom"></slot>
				<slot id="loading" name="loading"></slot>
			</dialog>
		`
		this.shadowRoot.adoptedStyleSheets = [BetterSelect.styleSheet]
		this.#internals.setFormValue("", "")

		this.tabIndex = 0

		this.#internals.role = "combobox"

		this.options = this.getElementsByTagName("option")

		for (const element of this.shadowRoot.querySelectorAll(`[id]`)) {
			this[element.id] = element
		}

		this.shadowRoot.addEventListener("click", event => {
			if (!(event.target instanceof HTMLElement)) return
			/** @type {HTMLLIElement} */
			const item = event.target.closest("#list > li")
			if (item) {
				if (!item.part.contains("disabled")) {
					this.setOption(item)
					this.dispatchEvent(new InputEvent("input", {bubbles: true}))
					this.close()
				}
			} else if (!this.#states.has("open")) {
				this.open()
			} else if (this.display.contains(event.target) || this.display.contains(event.target.closest("[slot]")?.assignedSlot)) {
				this.close()
			}
		})

		this.addEventListener("keydown", event => {
			const key = event.key
			if (this.#states.has("open")) {
				if (key == " " && this.list.contains(this.shadowRoot.activeElement)) {
					this.close()
					event.preventDefault()
					event.stopPropagation()
				} else if (key == "Escape") {
					this.close()
				}
			} else {
				if (key == " ") {
					this.open()
					event.preventDefault()
					event.stopPropagation()
				} else if (key == "Escape") {
					this.keyboardSearchBuffer = ""
					event.preventDefault()
					event.stopPropagation()
				} else if (key == "Backspace") {
					event.preventDefault()
					event.stopPropagation()
				} else if (!event.ctrlKey && !event.altKey && key.match(/^[a-zA-Z0-9]$/)) {
					this.keyboardSearchAppend(key)
					event.preventDefault()
					event.stopPropagation()
				}
			}
		})

		this.shadowRoot.addEventListener("input", event => {
			/** @type {HTMLInputElement} */
			const item = /** @type {HTMLElement} */(event.target).closest("#input")
			if (item) {
				this.search(item.value)
				event.stopPropagation()
			}
		})

		this.setValidity()
	}

	/**
	 * @param {String} key
	 */
	keyboardSearchAppend(key) {
		this.searchTimeout?.abort()
		this.searchTimeout = new AbortController()

		const timeout = 1000 * (Number(this.getAttribute("search-timeout")) || 1)
		const ref = setTimeout(()=> {
			this.keyboardSearchBuffer = ""
		}, timeout)
		this.searchTimeout.signal.addEventListener("abort", () => {
			window.clearTimeout(ref)
		})

		this.keyboardSearchBuffer = (this.keyboardSearchBuffer || "") + key

		this.closedSearch(this.keyboardSearchBuffer)
	}

	/** @param {string} search */
	closedSearch(search) {
		for (const item of this.list.children) {
			if ((item instanceof HTMLElement) && this.match(search, item)) {
				this.setOption(item)
				return
			}
		}
	}

	async open() {
		if (this.#abortOpen) return

		this.#abortOpen = new AbortController()

		const signal = this.closeSignal

		// Click events don't properly cross shadow-DOM boundaries.
		// Therefore: one event is needed for each nested shadow-DOM
		// in the element's ancestry.
		for (const {root, element} of ancestorRoots(this)) {
			root.addEventListener("click", event => {
				if (event.target instanceof HTMLElement) {
					// This can only happen within the same root as the
					// current element so can be handled trivially
					if (this.contains(event.target)) return

					// On every level, if an event originates from the containing
					// shadow host, it can get ignored, as the corresponding
					// shadow root event handler has already handled it.
					if (event.target == element) return

					// The event target wasn't inside the element
					// nor is indirectly hosting it.
					this.close()
				}
			}, {signal})
		}

		this.addEventListener("keypress", event => {
			if (event.key == "Enter") {
				this.selectDefault()
				this.dispatchEvent(new InputEvent("input", {bubbles: true}))
			}
		}, {signal})

		this.dialog.show()
		this.#states.add("open")

		if ("populate" in this) {
			this.#states.add("loading")
			// @ts-ignore
			await this.populate()
			this.#states.delete("loading")
		}
	}

	close() {
		this.input.value = null
		for (const hidden of this.list.querySelectorAll("[hidden]"))
			hidden.removeAttribute("hidden")
		this.#abortOpen?.abort()
		this.#abortOpen = null
		this.#states.delete("open")
		this.dialog.close()
	}

	get closeSignal() { return this.#abortOpen?.signal }

	/** @param {String} value */
	search(value) {
		for (const item of this.list.children) {
			if (item instanceof HTMLElement)
				item.toggleAttribute("hidden", !this.match(value, item))
		}
	}

	selectDefault() {
		const active = this.shadowRoot.activeElement
		if (active instanceof HTMLOptionElement && active?.matches(`[part="item"]`)) {
			this.setOption(active)
			this.close()
			return
		}
		const candidates = /** @type {HTMLElement[]} */(Array.from(this.list.children).filter(child => !child.hasAttribute("hidden")))
		if (candidates.length) {
			this.setOption(candidates[0])
			this.close()
		}
	}

	/**
	 * @param {string} value
	 * @param {HTMLElement} item
	 */
	match(value, item) {
		return item.innerText.toLowerCase().match(value.toLowerCase())
	}

	connectedCallback() {
		this.setOptions()
	}

	mutationCallback() {
		this.setOptions()
	}

	/** @param {HTMLElement} option */
	setOption(option) {
		return this.setValue(option.dataset.value, option.innerText)
	}

	/**
	 * @param {string} value
	 * @param {string} state
	 */
	setValue(value, state=value) {
		this.#value = {value, state}
		this.dispatchEvent(new Event("change", {bubbles: true}));
		this.#internals.setFormValue(value, state)
		this.text.innerText = state

		this.#states.toggle("value", value)

		this.updateClearButton()
		this.setValidity()
	}

	updateClearButton() {
		const template = /** @type {HTMLTemplateElement} */(this.shadowRoot.getElementById("clear-template"))
		const clearButton = template.nextElementSibling
		if (this.required || this.#value.value === undefined) {
			clearButton?.remove()
		} else if (!clearButton && !this.required) {
			const button = template.content.cloneNode(true)
			template.after(button)
			template.nextElementSibling.addEventListener("click", event => {
				event.stopPropagation()
				this.clear()
			})
		}
	}

	get value() { return this.#value.value }
	set value(value) {
		if (value === undefined) {
			this.clear()
		} else {
			for (const option of this.options) {
				if (option.value === String(value)) {
					this.setValue(option.value, option.innerText)
					return
				}
			}
		}
		throw `No option with value ${value}`
	}

	get valueText() { return this.#value.state }

	setOptions() {
		this.list.replaceChildren()
		for (const option of this.options) {
			const fragment = f`<li tabindex="0" part="item" data-value="${option.value}">${option.innerText}</li>`
			const li = fragment.querySelector("li")
			if (option.disabled) {
				li.part.add("disabled")
				li.removeAttribute("tabindex")
			} else {
				li.part.add("enabled")
			}
			this.list.append(fragment)
			if (this.value == undefined && option.selected) {
				this.value = option.value
			}
		}
	}

	/** Changes the placeholder displayed in the display area
	 * @param {string} text
	 */
	placeholderChanged(text) {
		this.placeholder.innerText = text
	}

	/** Changes the placeholder displayed in the search box when the drop-down is open
	 * @param {string} text
	 */
	searchPlaceholderChanged(text) {
		this.input.placeholder = text
	}

	/**
	 * @return {String}
	 */
	get name() { return this.getAttribute("name") }

	/**
	 * @param {String} name
	 */
	set name(name) { this.setAttribute("name", String(name)) }

	get form() { return this.#internals.form }

	clear() {
		this.setValue(undefined, "")
	}

	/**
	 * @param {Boolean} disabled
	 */
	set disabled(disabled) { this.toggleAttribute("disabled", disabled) }
	get disabled() { return this.hasAttribute("disabled") }

	/**
	 * @param {ValidityConstraint} _constraint
	 */
	validityMessage(_constraint) {
		return "Please select an option."
	}


	setValidity() {
		if (this.required) {
			const valid = Boolean(this.value)
			if (valid) {
				this.#internals.setValidity({})
			} else {
				this.#internals.setValidity({valueMissing: true}, this.validityMessage("valueMissing"))
			}
			return valid
		} else {
			this.#internals.setValidity({})
			return true
		}
	}

	checkValidity() { return this.#internals.checkValidity() }

	get validity() { return this.#internals.validity }

	get validationMessage() { return this.#internals.validationMessage }

	get willValidate() { return this.#internals.willValidate }

	/**
	 * @param {Boolean} required
	 */
	set required(required) { this.toggleAttribute("required", required) }
	get required() { return this.hasAttribute("required") }

	reportValidity() { return this.#internals.reportValidity() }

	requiredChanged() {
		this.updateClearButton()
		this.setValidity()
	}

	/**
	 * @param {String} name
	 * @param {String} before
	 * @param {String} after
	 */
	attributeChangedCallback(name, before, after) {
		const methodName = name.replace(/-([a-z])/g, (_all, letter) => (letter.toUpperCase())) + "Changed"
		if (methodName in this) this[methodName](after, before)
	}
}
