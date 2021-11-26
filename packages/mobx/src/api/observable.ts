import {
    IEnhancer,
    IEqualsComparer,
    IObservableArray,
    IObservableMapInitialValues,
    IObservableSetInitialValues,
    IObservableValue,
    ObservableMap,
    ObservableSet,
    ObservableValue,
    asDynamicObservableObject,
    createObservableArray,
    deepEnhancer,
    extendObservable,
    isES6Map,
    isES6Set,
    isObservable,
    isPlainObject,
    referenceEnhancer,
    Annotation,
    shallowEnhancer,
    refStructEnhancer,
    AnnotationsMap,
    asObservableObject,
    storeAnnotation,
    createDecoratorAnnotation,
    createLegacyArray,
    globalState,
    assign,
    isStringish,
    createObservableAnnotation,
    createAutoAnnotation
} from "../internal"

export const OBSERVABLE = "observable"
export const OBSERVABLE_REF = "observable.ref"
export const OBSERVABLE_SHALLOW = "observable.shallow"
export const OBSERVABLE_STRUCT = "observable.struct"

export type CreateObservableOptions = {
    name?: string
    equals?: IEqualsComparer<any>
    deep?: boolean
    defaultDecorator?: Annotation
    proxy?: boolean
    autoBind?: boolean
}

// Predefined bags of create observable options, to avoid allocating temporarily option objects
// in the majority of cases
export const defaultCreateObservableOptions: CreateObservableOptions = {
    deep: true,
    name: undefined,
    defaultDecorator: undefined,
    proxy: true
}
Object.freeze(defaultCreateObservableOptions)

export function asCreateObservableOptions(thing: any): CreateObservableOptions {
    return thing || defaultCreateObservableOptions
}

const observableAnnotation = createObservableAnnotation(OBSERVABLE)
const observableRefAnnotation = createObservableAnnotation(OBSERVABLE_REF, {
    enhancer: referenceEnhancer
})
const observableShallowAnnotation = createObservableAnnotation(OBSERVABLE_SHALLOW, {
    enhancer: shallowEnhancer
})
const observableStructAnnotation = createObservableAnnotation(OBSERVABLE_STRUCT, {
    enhancer: refStructEnhancer
})
const observableDecoratorAnnotation = createDecoratorAnnotation(observableAnnotation)

export function getEnhancerFromOptions(options: CreateObservableOptions): IEnhancer<any> {
    return options.deep === true
        ? deepEnhancer
        : options.deep === false
            ? referenceEnhancer
            : getEnhancerFromAnnotation(options.defaultDecorator)
}

// 从 options 里获取注解
export function getAnnotationFromOptions(
    options?: CreateObservableOptions
): Annotation | undefined {
    // defaultDecorator 是个啥？没看明白
    return options ? options.defaultDecorator ?? createAutoAnnotation(options) : undefined
}

export function getEnhancerFromAnnotation(annotation?: Annotation): IEnhancer<any> {
    return !annotation ? deepEnhancer : annotation.options_?.enhancer ?? deepEnhancer
}

/**
 * Turns an object, array or function into a reactive structure.
 * @param v the value which should become observable.
 */
function createObservable(v: any, arg2?: any, arg3?: any) {
    // @observable someProp;
    if (isStringish(arg2)) {
        storeAnnotation(v, arg2, observableAnnotation)
        return
    }

    // already observable - ignore
    if (isObservable(v)) return v

    // plain object
    if (isPlainObject(v)) return observable.object(v, arg2, arg3)

    // Array
    if (Array.isArray(v)) return observable.array(v, arg2)

    // Map
    if (isES6Map(v)) return observable.map(v, arg2)

    // Set
    if (isES6Set(v)) return observable.set(v, arg2)

    // other object - ignore
    if (typeof v === "object" && v !== null) return v

    // anything else
    return observable.box(v, arg2)
}
Object.assign(createObservable, observableDecoratorAnnotation)

export interface IObservableFactory extends Annotation, PropertyDecorator {
    <T = any>(value: T[], options?: CreateObservableOptions): IObservableArray<T>
    <T = any>(value: Set<T>, options?: CreateObservableOptions): ObservableSet<T>
    <K = any, V = any>(value: Map<K, V>, options?: CreateObservableOptions): ObservableMap<K, V>
    <T extends object>(
        value: T,
        decorators?: AnnotationsMap<T, never>,
        options?: CreateObservableOptions
    ): T

    box: <T = any>(value?: T, options?: CreateObservableOptions) => IObservableValue<T>
    array: <T = any>(initialValues?: T[], options?: CreateObservableOptions) => IObservableArray<T>
    set: <T = any>(
        initialValues?: IObservableSetInitialValues<T>,
        options?: CreateObservableOptions
    ) => ObservableSet<T>
    map: <K = any, V = any>(
        initialValues?: IObservableMapInitialValues<K, V>,
        options?: CreateObservableOptions
    ) => ObservableMap<K, V>
    object: <T = any>(
        props: T,
        decorators?: AnnotationsMap<T, never>,
        options?: CreateObservableOptions
    ) => T

    /**
     * Decorator that creates an observable that only observes the references, but doesn't try to turn the assigned value into an observable.ts.
     */
    ref: Annotation & PropertyDecorator
    /**
     * Decorator that creates an observable converts its value (objects, maps or arrays) into a shallow observable structure
     */
    shallow: Annotation & PropertyDecorator
    deep: Annotation & PropertyDecorator
    struct: Annotation & PropertyDecorator
}

const observableFactories: IObservableFactory = {
    box<T = any>(value?: T, options?: CreateObservableOptions): IObservableValue<T> {
        const o = asCreateObservableOptions(options)
        return new ObservableValue(value, getEnhancerFromOptions(o), o.name, true, o.equals)
    },
    array<T = any>(initialValues?: T[], options?: CreateObservableOptions): IObservableArray<T> {
        const o = asCreateObservableOptions(options)
        return (globalState.useProxies === false || o.proxy === false
            ? createLegacyArray
            : createObservableArray)(initialValues, getEnhancerFromOptions(o), o.name)
    },
    map<K = any, V = any>(
        initialValues?: IObservableMapInitialValues<K, V>,
        options?: CreateObservableOptions
    ): ObservableMap<K, V> {
        const o = asCreateObservableOptions(options)
        return new ObservableMap<K, V>(initialValues, getEnhancerFromOptions(o), o.name)
    },
    set<T = any>(
        initialValues?: IObservableSetInitialValues<T>,
        options?: CreateObservableOptions
    ): ObservableSet<T> {
        const o = asCreateObservableOptions(options)
        return new ObservableSet<T>(initialValues, getEnhancerFromOptions(o), o.name)
    },
    /**
     * 如果把一个普通的 JavaScript 对象传递给 observable 方法，对象的所有属性都将被拷贝至一个克隆对象并将克隆对象转变成可观察的。
     *  (普通对象是指不是使用构造函数创建出来的对象，而是以 Object 作为其原型，或者根本没有原型。) 
     */
    object<T = any>(
        props: T,
        decorators?: AnnotationsMap<T, never>,
        options?: CreateObservableOptions
    ): T {
        return extendObservable(
            globalState.useProxies === false || options?.proxy === false
                ? asObservableObject({}, options)
                // 用 proxy 的话..
                : asDynamicObservableObject({}, options),
            props,
            decorators
        )
    },
    ref: createDecoratorAnnotation(observableRefAnnotation),
    shallow: createDecoratorAnnotation(observableShallowAnnotation),
    deep: observableDecoratorAnnotation,
    struct: createDecoratorAnnotation(observableStructAnnotation)
} as any

// eslint-disable-next-line
// assign 就是 Object.assign，给 createObservable 这个函数增加属性，如 box, map 来生成特定的 observable
export var observable: IObservableFactory = assign(createObservable, observableFactories)
