## Slots

* `placeholder`: Only shown when nothing is selected
* `loading`: Hidden by default, shown instead of items while `populate()` runs

## Parts

* `display`: The outer display box that is always shown
* `display-text`: The text representing the currently selected value
* `drop-down`: The dialog element that pops up when the list is opened
* `search`: The search input box
* `list`: The wrapper containing the items
* `item`: The individual selectable list items

## Hooks

* `populate()`: If present, gets called after opening to populate the options list
* `search(string)`: Called on search input to update the list of options
* `match(string, element)`: Used by `search` to compare each option to the search string

## Attributes

* `closeSignal`: An AbortSignal that fires when the drop-down closes

## Events

* `change`: Fired whenever the value changes, even if via JavaScript
* `input`: Fired when the value is changed by selecting an option (after `change`)
