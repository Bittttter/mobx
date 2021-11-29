import { globalState, die } from "../internal"

// We shorten anything used > 5 times
export const assign = Object.assign
export const getDescriptor = Object.getOwnPropertyDescriptor
export const defineProperty = Object.defineProperty
export const objectPrototype = Object.prototype

export const EMPTY_ARRAY = []
Object.freeze(EMPTY_ARRAY)

export const EMPTY_OBJECT = {}
Object.freeze(EMPTY_OBJECT)

export interface Lambda {
    (): void
    name?: string
}

const hasProxy = typeof Proxy !== "undefined"
const plainObjectString = Object.toString()

/** 断言是否能用 Proxy */
export function assertProxies() {
    if (!hasProxy) {
        die(
            __DEV__
                ? "`Proxy` objects are not available in the current environment. Please configure MobX to enable a fallback implementation.`"
                : "Proxy not available"
        )
    }
}

export function warnAboutProxyRequirement(msg: string) {
    if (__DEV__ && globalState.verifyProxies) {
        die(
            "MobX is currently configured to be able to run in ES5 mode, but in ES5 MobX won't be able to " +
                msg
        )
    }
}

export function getNextId() {
    return ++globalState.mobxGuid
}

/**
 * Makes sure that the provided function is invoked at most once.
 */
export function once(func: Lambda): Lambda {
    let invoked = false
    return function () {
        if (invoked) return
        invoked = true
        return (func as any).apply(this, arguments)
    }
}

export const noop = () => {}

export function isFunction(fn: any): fn is Function {
    return typeof fn === "function"
}

export function isString(value: any): value is string {
    return typeof value === "string"
}

export function isStringish(value: any): value is string | number | symbol {
    const t = typeof value
    switch (t) {
        case "string":
        case "symbol":
        case "number":
            return true
    }
    return false
}

export function isObject(value: any): value is Object {
    return value !== null && typeof value === "object"
}

/** plainObject 纯对象，区别于 RegExp,Date 那些东西 */
export function isPlainObject(value) {
    if (!isObject(value)) return false
    const proto = Object.getPrototypeOf(value)
    if (proto == null) return true
    // 是某个自定义类的实例也不行哈
    return proto.constructor?.toString() === plainObjectString
}

// https://stackoverflow.com/a/37865170
export function isGenerator(obj: any): boolean {
    const constructor = obj?.constructor
    if (!constructor) return false
    if ("GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName)
        return true
    return false
}

/** 给对象添加一个不可枚举的属性 */
export function addHiddenProp(object: any, propName: PropertyKey, value: any) {
    defineProperty(object, propName, {
        enumerable: false,
        writable: true,
        configurable: true,
        value
    })
}

export function addHiddenFinalProp(object: any, propName: PropertyKey, value: any) {
    defineProperty(object, propName, {
        enumerable: false,
        writable: false,
        configurable: true,
        value
    })
}

/** 通过谓词创建实例？其实就是返回一个判断函数，判断原型上的 `isMobX[theClass]` 是否为 true */
export function createInstanceofPredicate<T>(
    name: string,
    theClass: new (...args: any[]) => T
): (x: any) => x is T {
    const propName = "isMobX" + name
    theClass.prototype[propName] = true
    return function (x) {
        return isObject(x) && x[propName] === true
    } as any
}

export function isES6Map(thing): boolean {
    return thing instanceof Map
}

export function isES6Set(thing): thing is Set<any> {
    return thing instanceof Set
}

const hasGetOwnPropertySymbols = typeof Object.getOwnPropertySymbols !== "undefined"

/**
 * Returns the following: own enumerable keys and symbols.
 */
export function getPlainObjectKeys(object) {
    const keys = Object.keys(object)
    // Not supported in IE, so there are not going to be symbol props anyway...
    if (!hasGetOwnPropertySymbols) return keys
    const symbols = Object.getOwnPropertySymbols(object)
    if (!symbols.length) return keys
    return [...keys, ...symbols.filter(s => objectPrototype.propertyIsEnumerable.call(object, s))]
}

// From Immer utils
// Returns all own keys, including non-enumerable and symbolic
export const ownKeys: (target: any) => PropertyKey[] =
    typeof Reflect !== "undefined" && Reflect.ownKeys
        ? Reflect.ownKeys
        : hasGetOwnPropertySymbols
        ? obj => Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj) as any)
        : /* istanbul ignore next */ Object.getOwnPropertyNames

export function stringifyKey(key: any): string {
    if (typeof key === "string") return key
    if (typeof key === "symbol") return key.toString()
    return new String(key).toString()
}

export function toPrimitive(value) {
    return value === null ? null : typeof value === "object" ? "" + value : value
}

// 涉及原型链的知识 instance.__proto__ === class.prototype
export function hasProp(target: Object, prop: PropertyKey): boolean {
    return objectPrototype.hasOwnProperty.call(target, prop)
}

// From Immer utils
/** 获取对象属性的 descriptors */
export const getOwnPropertyDescriptors =
    Object.getOwnPropertyDescriptors ||
    function getOwnPropertyDescriptors(target: any) {
        // Polyfill needed for Hermes and IE, see https://github.com/facebook/hermes/issues/274
        const res: any = {}
        // Note: without polyfill for ownKeys, symbols won't be picked up
        ownKeys(target).forEach(key => {
            res[key] = getDescriptor(target, key)
        })
        return res
    }
