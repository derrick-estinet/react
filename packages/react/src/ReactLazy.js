/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {REACT_LAZY_TYPE} from 'shared/ReactSymbols';

type Thenable<T, R> = {
  then(resolve: (T) => mixed, reject: (mixed) => mixed): R,
};

const Uninitialized = -1;
const Pending = 0;
const Resolved = 1;
const Rejected = 2;

type UninitializedPayload<T> = {
  _status: -1,
  _result: () => Thenable<{default: T, ...}, mixed>,
};

type PendingPayload<T> = {
  _status: 0,
  _result: Thenable<{default: T, ...}, mixed>,
};

type ResolvedPayload<T> = {
  _status: 1,
  _result: T,
};

type RejectedPayload = {
  _status: 2,
  _result: mixed,
};

type Payload<T> =
  | UninitializedPayload<T>
  | PendingPayload<T>
  | ResolvedPayload<T>
  | RejectedPayload;

export type LazyComponent<T, P> = {
  $$typeof: Symbol | number,
  _payload: P,
  _init: (payload: P) => T,
};

function lazyInitializer<T>(payload: Payload<T>): T {
  if (payload._status === Uninitialized) {
    const ctor = payload._result;
    const thenable = ctor();
    // Transition to the next state.
    const pending: PendingPayload<any> = (payload: any);
    pending._status = Pending;
    pending._result = thenable;
    thenable.then(
      moduleObject => {
        if (payload._status === Pending) {
          const defaultExport = moduleObject.default;
          if (__DEV__) {
            if (defaultExport === undefined) {
              console.error(
                'lazy: Expected the result of a dynamic import() call. ' +
                  'Instead received: %s\n\nYour code should look like: \n  ' +
                  // Break up imports to avoid accidentally parsing them as dependencies.
                  'const MyComponent = lazy(() => imp' +
                  "ort('./MyComponent'))",
                moduleObject,
              );
            }
          }
          // Transition to the next state.
          const resolved: ResolvedPayload<any> = (payload: any);
          resolved._status = Resolved;
          resolved._result = defaultExport;
        }
      },
      error => {
        if (payload._status === Pending) {
          // Transition to the next state.
          const rejected: RejectedPayload = (payload: any);
          rejected._status = Rejected;
          rejected._result = error;
        }
      },
    );
  }
  if (payload._status === Resolved) {
    return payload._result;
  } else {
    throw payload._result;
  }
}

export function lazy<T>(
  ctor: () => Thenable<{default: T, ...}, mixed>,
): LazyComponent<T, Payload<T>> {
  let payload: Payload<T> = {
    // We use these fields to store the result.
    _status: -1,
    _result: ctor,
  };

  let lazyType: LazyComponent<T, Payload<T>> = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: payload,
    _init: lazyInitializer,
  };

  if (__DEV__) {
    // In production, this would just set it on the object.
    let defaultProps;
    let propTypes;
    // $FlowFixMe
    Object.defineProperties(lazyType, {
      defaultProps: {
        configurable: true,
        get() {
          return defaultProps;
        },
        set(newDefaultProps) {
          console.error(
            'React.lazy(...): It is not supported to assign `defaultProps` to ' +
              'a lazy component import. Either specify them where the component ' +
              'is defined, or create a wrapping component around it.',
          );
          defaultProps = newDefaultProps;
          // Match production behavior more closely:
          // $FlowFixMe
          Object.defineProperty(lazyType, 'defaultProps', {
            enumerable: true,
          });
        },
      },
      propTypes: {
        configurable: true,
        get() {
          return propTypes;
        },
        set(newPropTypes) {
          console.error(
            'React.lazy(...): It is not supported to assign `propTypes` to ' +
              'a lazy component import. Either specify them where the component ' +
              'is defined, or create a wrapping component around it.',
          );
          propTypes = newPropTypes;
          // Match production behavior more closely:
          // $FlowFixMe
          Object.defineProperty(lazyType, 'propTypes', {
            enumerable: true,
          });
        },
      },
    });
  }

  return lazyType;
}
