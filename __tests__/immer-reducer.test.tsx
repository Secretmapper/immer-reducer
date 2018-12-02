import {
    ImmerReducer,
    createReducerFunction,
    createActionCreators,
    _clearKnownClasses,
} from "../src/immer-reducer";

import {createStore, combineReducers} from "redux";

interface Reducer<State> {
    (state: State, action: any): State;
}

beforeEach(_clearKnownClasses);

/**
 * Combine multiple reducers into a single one
 *
 * @param reducers two or more reducer
 */
function composeReducers<State>(
    ...reducers: (Reducer<State | undefined>)[]
): Reducer<State | undefined> {
    return (state: any, action: any) => {
        return (
            reducers.reduce((state, subReducer) => {
                if (typeof subReducer === "function") {
                    return subReducer(state, action);
                }

                return state;
            }, state) || state
        );
    };
}

test("can create reducers", () => {
    const initialState = {foo: "bar"};

    class TestReducer extends ImmerReducer<typeof initialState> {
        setFoo(foo: string) {
            this.draftState.foo = foo;
        }
    }

    const reducer = createReducerFunction(TestReducer);
    const store = createStore(reducer, initialState);

    expect(store.getState()).toEqual({foo: "bar"});
});

test("the reducer can return the initial state", () => {
    const initialState = {foo: "bar"};

    class TestReducer extends ImmerReducer<typeof initialState> {
        setFoo(foo: string) {
            this.draftState.foo = foo;
        }
    }

    const reducer = createReducerFunction(TestReducer, initialState);
    const store = createStore(reducer);

    expect(store.getState()).toEqual({foo: "bar"});
});

test("can dispatch actions", () => {
    const initialState = {foo: "bar"};

    class TestReducer extends ImmerReducer<typeof initialState> {
        noop() {}
    }

    const ActionCreators = createActionCreators(TestReducer);
    const reducer = createReducerFunction(TestReducer);
    const store = createStore(reducer, initialState);

    store.dispatch(ActionCreators.noop());

    expect(store.getState()).toEqual({foo: "bar"});
});

test("can update state", () => {
    const initialState = {foo: "bar"};

    class TestReducer extends ImmerReducer<typeof initialState> {
        setFoo(foo: string) {
            this.draftState.foo = foo;
        }
    }

    const ActionCreators = createActionCreators(TestReducer);
    const reducer = createReducerFunction(TestReducer);
    const store = createStore(reducer, initialState);

    store.dispatch(ActionCreators.setFoo("next"));

    expect(store.getState()).toEqual({foo: "next"});
});

test("can update state using mutiple methods", () => {
    const initialState = {foo: "bar", bar: 1};

    class TestReducer extends ImmerReducer<typeof initialState> {
        setFoo(foo: string) {
            this.draftState.foo = foo;
        }

        setBar(bar: number) {
            this.draftState.bar = bar;
        }

        setBoth(foo: string, bar: number) {
            this.setFoo(foo);
            this.setBar(bar);
        }
    }

    const ActionCreators = createActionCreators(TestReducer);
    const reducer = createReducerFunction(TestReducer);
    const store = createStore(reducer, initialState);

    store.dispatch(ActionCreators.setBoth("next", 2));

    expect(store.getState()).toEqual({foo: "next", bar: 2});
});

test("the actual action type name is prefixed", () => {
    const initialState = {foo: "bar"};

    class TestReducer extends ImmerReducer<typeof initialState> {
        setFoo(foo: string) {
            this.draftState.foo = foo;
        }
    }

    const ActionCreators = createActionCreators(TestReducer);

    const reducer = createReducerFunction(TestReducer);
    const reducerSpy: typeof reducer = jest.fn(reducer);

    const store = createStore(reducerSpy, initialState);

    store.dispatch(ActionCreators.setFoo("next"));

    expect(reducerSpy).toHaveBeenLastCalledWith(
        {foo: "bar"},
        {
            payload: ["next"],
            type: "IMMER_REDUCER:TestReducer#setFoo",
        },
    );
});

test("can add helpers to the class", () => {
    const initialState = {foo: 1, bar: 1};

    class Helper {
        state: typeof initialState;

        constructor(state: typeof initialState) {
            this.state = state;
        }

        getCombined() {
            return this.state.foo + this.state.bar;
        }
    }

    class TestReducer extends ImmerReducer<typeof initialState> {
        helper = new Helper(this.state);

        combineToBar() {
            this.draftState.bar = this.helper.getCombined();
        }
    }

    const ActionCreators = createActionCreators(TestReducer);
    const reducer = createReducerFunction(TestReducer);
    const store = createStore(reducer, initialState);

    store.dispatch(ActionCreators.combineToBar());

    expect(store.getState()).toEqual({foo: 1, bar: 2});
});

test("can use combineReducers", () => {
    interface State1 {
        foo: number;
    }

    interface State2 {
        bar: string;
    }

    class TestReducer1 extends ImmerReducer<State1> {
        setFoo(foo: number) {
            this.draftState.foo = foo;
        }
    }

    class TestReducer2 extends ImmerReducer<State2> {
        setBar(bar: string) {
            this.draftState.bar = bar;
        }
    }

    const ActionCreators1 = createActionCreators(TestReducer1);
    const ActionCreators2 = createActionCreators(TestReducer2);

    const slice1 = createReducerFunction(TestReducer1, {foo: 0});
    const slice2 = createReducerFunction(TestReducer2, {bar: ""});

    const combined = combineReducers({slice1, slice2});

    const store = createStore(combined);

    store.dispatch(ActionCreators1.setFoo(1));
    store.dispatch(ActionCreators2.setBar("barval"));

    const state: {
        slice1: State1;
        slice2: State2;
    } = store.getState();

    expect(state).toEqual({slice1: {foo: 1}, slice2: {bar: "barval"}});
});

test("cannot collide reducers", () => {
    const initialState = {foo: "bar"};

    class TestReducer1 extends ImmerReducer<typeof initialState> {
        setFoo() {
            this.draftState.foo = "1";
        }
    }

    class TestReducer2 extends ImmerReducer<typeof initialState> {
        setFoo() {
            this.draftState.foo = "2";
        }
    }

    const reducer = composeReducers(
        createReducerFunction(TestReducer1),
        createReducerFunction(TestReducer2),
    );

    const store = createStore(reducer, initialState);

    const ActionCreators1 = createActionCreators(TestReducer1);
    const ActionCreators2 = createActionCreators(TestReducer2);

    store.dispatch(ActionCreators1.setFoo());
    expect(store.getState()).toEqual({foo: "1"});

    store.dispatch(ActionCreators2.setFoo());
    expect(store.getState()).toEqual({foo: "2"});
});

test("dynamically generated reducers do not collide", () => {
    const initialState = {
        foo: "",
    };

    function createGenericReducer<T extends {[key: string]: unknown}>(
        value: string,
    ) {
        return class GenericReducer extends ImmerReducer<T> {
            set() {
                Object.assign(this.draftState, {foo: value});
            }
        };
    }
    const ReducerClass1 = createGenericReducer<typeof initialState>("1");
    const ReducerClass2 = createGenericReducer<typeof initialState>("2");

    const reducer1 = createReducerFunction(ReducerClass1, initialState);
    const reducer2 = createReducerFunction(ReducerClass2, initialState);

    const reducer = composeReducers(reducer1, reducer2);

    const ActionCreators1 = createActionCreators(ReducerClass1);
    const ActionCreators2 = createActionCreators(ReducerClass2);

    const store = createStore(reducer);

    store.dispatch(ActionCreators1.set());
    expect(store.getState().foo).toEqual("1");

    store.dispatch(ActionCreators2.set());
    expect(store.getState().foo).toEqual("2");
});

test("throw error when using duplicate customNames", () => {
    class Reducer1 extends ImmerReducer<{foo: string}> {
        static customName = "dup";
        set() {
            this.draftState.foo = "foo";
        }
    }

    class Reducer2 extends ImmerReducer<{foo: string}> {
        static customName = "dup";
        set() {
            this.draftState.foo = "foo";
        }
    }

    createReducerFunction(Reducer1);

    expect(() => {
        createReducerFunction(Reducer2);
    }).toThrow();
});

test("action creators expose the actual action type name", () => {
    const initialState = {foo: "bar"};

    class TestReducer extends ImmerReducer<typeof initialState> {
        setBar(foo: string) {
            this.draftState.foo = foo;
        }
    }

    const ActionCreators = createActionCreators(TestReducer);

    expect(ActionCreators.setBar.type).toEqual(
        "IMMER_REDUCER:TestReducer#setBar",
    );
});
