## Attributes

* `placeholder` Placeholder displayed when nothing is selected
* `search-placeholder` Placeholder passed to the search input in the drop-down

## Slots

* `clear`: Overrides the default "x" clear button
* `loading`: Hidden by default, shown instead of items while `populate()` runs
* `placeholder`: Only shown when nothing is selected (replaces attribute placeholder if present)

* `top`: Insert content at the top of the drop-down
* `below-search`: Insert content beltween the search box and item list
* `bottom`: Insert content at the bottom of the drop-down

## Parts

* `clear`: The slot containing the clear button
* `display-text`: The text representing the currently selected value
* `display`: The outer display box that is always shown
* `drop-down`: The dialog element that pops up when the list is opened
* `item`: The individual selectable list items
    * `item disabled`: Any item corresponding to a disabled option
    * `item enabled`: Any item correesponding to a not disabled option
* `list`: The wrapper containing the items
* `placeholder`: The slot containing the placeholder text
* `search`: The search input box

## Hooks

* `populate()`: If present, gets called after opening to populate the options list
* `search(string)`: Called on search input to update the list of options
* `match(string, element)`: Used by `search` to compare each option to the search string

## Properties

* `closeSignal`: (read-only) An AbortSignal that fires when the drop-down closes

## Events

* `change`: Fired whenever the value changes, even if via JavaScript
* `input`: Fired when the value is changed by selecting an option (after `change`)
