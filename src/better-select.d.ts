export class BetterSelect extends HTMLElement {
    static formAssociated: boolean;
    static observedAttributes: readonly string[];
    static styleSheet: CSSStyleSheet;
    static searchHideDisabled: boolean;
    /** @type {HTMLElement} */
    display: HTMLElement;
    /** @type {HTMLElement} */
    text: HTMLElement;
    /** @type {HTMLElement} */
    list: HTMLElement;
    /** @type {HTMLElement} */
    placeholder: HTMLElement;
    /** @type {HTMLInputElement} */
    input: HTMLInputElement;
    /** @type {HTMLDialogElement} */
    dialog: HTMLDialogElement;
    /** @type {HTMLDialogElement} */
    loading: HTMLDialogElement;
    options: HTMLCollectionOf<HTMLOptionElement>;
    keyboardSearchBuffer: string;
    dispatchInputEvent(): void;
    /**
     * @param {String} key
     */
    keyboardSearchAppend(key: string): void;
    searchTimeout: AbortController;
    /** @param {string} search */
    closedSearch(search: string): void;
    open(): Promise<void>;
    close(): void;
    get closeSignal(): AbortSignal;
    /** @param {String} value */
    search(value: string): void;
    selectDefault(): void;
    /**
     * @param {string} value
     * @param {HTMLElement} item
     */
    match(value: string, item: HTMLElement): false | RegExpMatchArray;
    connectedCallback(): void;
    mutationCallback(): void;
    /** @param {HTMLElement} option */
    setOption(option: HTMLElement): void;
    /** Callback used by the browser to (re)set the value
     * @see {@link https://html.spec.whatwg.org/multipage/custom-elements.html#face-state Specification}
     * @param {string} state
     */
    formStateRestoreCallback(state: string): void;
    /**
     * @param {number} index
     * @param {string} value
     * @param {string} state
     */
    setValue(index: number, value: string, state?: string): void;
    updateClearButton(): void;
    set value(value: any);
    get value(): any;
    get valueText(): any;
    setOptions(): void;
    /** Changes the placeholder displayed in the display area
     * @param {string} text
     */
    placeholderChanged(text: string): void;
    /** Changes the placeholder displayed in the search box when the drop-down is open
     * @param {string} text
     */
    searchPlaceholderChanged(text: string): void;
    /**
     * @param {String} name
     */
    set name(name: string);
    /**
     * @return {String}
     */
    get name(): string;
    get form(): HTMLFormElement;
    clear(): void;
    /**
     * @param {Boolean} disabled
     */
    set disabled(disabled: boolean);
    get disabled(): boolean;
    /**
     * @param {ValidityConstraint} _constraint
     */
    validityMessage(_constraint: ValidityConstraint): string;
    next(): void;
    previous(): void;
    setValidity(): boolean;
    checkValidity(): boolean;
    get validity(): ValidityState;
    get validationMessage(): string;
    get willValidate(): boolean;
    /**
     * @param {Boolean} required
     */
    set required(required: boolean);
    get required(): boolean;
    reportValidity(): boolean;
    requiredChanged(): void;
    /**
     * @param {String} name
     * @param {String} before
     * @param {String} after
     */
    attributeChangedCallback(name: string, before: string, after: string): void;
    #private;
}
export type ValidityConstraint = "badInput" | "customError" | "patternMismatch" | "rangeOverflow" | "rangeUnderflow" | "stepMismatch" | "tooLong" | "tooShort" | "typeMismatch" | "valid" | "valueMissing";
export type Template<Result> = ((arr: TemplateStringsArray, ...params: string[]) => Result) & ((string: string) => Result);
