import { configureStore, Store } from "@reduxjs/toolkit";
import { createInjectorsEnhancer } from "redux-injectors";
import createSagaMiddleware from "redux-saga";
import { createReducer } from "./reducers";
import { celebrationSaga } from "../app/slice/celebrationSlice/saga";

export function configureAppStore(): Store {
  const reduxSagaOptions = {};
  const sagaMiddleware = createSagaMiddleware(reduxSagaOptions);
  const { run: runSaga } = sagaMiddleware;

  const middlewares = [sagaMiddleware];

  const enhancers = [
    createInjectorsEnhancer({
      createReducer,
      runSaga,
    }),
  ];

  const store = configureStore({
    reducer: createReducer(),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        thunk: false,
      }).concat(middlewares),
    devTools: process.env.NODE_ENV !== "production",
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers().concat(enhancers) as any,
  });

  // Run celebration saga
  sagaMiddleware.run(celebrationSaga);

  return store;
}

export const store = configureAppStore();
