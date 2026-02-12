import type {
  GlyphNode,
  GlyphTextInstance,
  GlyphContainer,
  GlyphNodeType,
  GlyphChild,
} from "./nodes.js";
import {
  createGlyphNode,
  appendChild as glyphAppendChild,
  appendTextChild as glyphAppendTextChild,
  removeChild as glyphRemoveChild,
  removeTextChild as glyphRemoveTextChild,
  insertBefore as glyphInsertBefore,
  insertTextBefore as glyphInsertTextBefore,
} from "./nodes.js";
import type { Style } from "../types/index.js";

// react-reconciler/constants
// We import these at the module level - they're simple numeric values
const DefaultEventPriority = 32;

type Props = Record<string, any>;

export const hostConfig = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: true,

  // Timeouts
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1 as const,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,

  // Priority & event methods required by react-reconciler v0.31
  getCurrentUpdatePriority: () => DefaultEventPriority,
  setCurrentUpdatePriority: (_priority: number) => {},
  resolveUpdatePriority: () => DefaultEventPriority,
  getCurrentEventPriority: () => DefaultEventPriority,
  resolveEventType: () => null as any,
  resolveEventTimeStamp: () => -1.1,
  shouldAttemptEagerTransition: () => false,

  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur: () => {},
  afterActiveInstanceBlur: () => {},
  prepareScopeUpdate: () => {},
  getInstanceFromScope: () => null,
  detachDeletedInstance: () => {},

  requestPostPaintCallback: (_callback: any) => {},

  // Commit suspension stubs (required by react-reconciler v0.31)
  maySuspendCommit: (_type: string, _props: Props) => false,
  preloadInstance: (_type: string, _props: Props) => true,
  startSuspendingCommit: () => {},
  suspendInstance: (_type: string, _props: Props) => {},
  waitForCommitToBeReady: () => null,

  // Transition stubs
  NotPendingTransition: null as any,
  HostTransitionContext: { $$typeof: Symbol.for("react.context"), _currentValue: null as any } as any,
  resetFormInstance: (_instance: any) => {},

  // Console binding
  bindToConsole: (methodName: string, args: any[], _errorPrefix: string) => {
    return (Function.prototype.bind as any).call(
      (console as any)[methodName],
      console,
      ...args,
    );
  },

  // Resource/singleton stubs
  supportsResources: false,
  isHostHoistableType: (_type: string, _props: Props) => false,
  supportsSingletons: false,
  isHostSingletonType: (_type: string) => false,
  supportsTestSelectors: false,

  createInstance(
    type: string,
    props: Props,
    _rootContainer: GlyphContainer,
    _hostContext: null,
    _internalHandle: any,
  ): GlyphNode {
    return createGlyphNode(type as GlyphNodeType, props);
  },

  createTextInstance(
    text: string,
    _rootContainer: GlyphContainer,
    _hostContext: null,
    _internalHandle: any,
  ): GlyphTextInstance {
    return { type: "raw-text", text, parent: null };
  },

  appendInitialChild(
    parentInstance: GlyphNode,
    child: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text") {
      glyphAppendTextChild(parentInstance, child as GlyphTextInstance);
    } else {
      glyphAppendChild(parentInstance, child as GlyphNode);
    }
  },

  finalizeInitialChildren(
    _instance: GlyphNode,
    _type: string,
    _props: Props,
    _rootContainer: GlyphContainer,
    _hostContext: null,
  ): boolean {
    return false;
  },

  shouldSetTextContent(_type: string, _props: Props): boolean {
    return false;
  },

  getRootHostContext(_rootContainer: GlyphContainer): Record<string, never> {
    return {};
  },

  getChildHostContext(
    parentHostContext: Record<string, never>,
    _type: string,
    _rootContainer: GlyphContainer,
  ): Record<string, never> {
    return parentHostContext;
  },

  getPublicInstance(instance: GlyphNode | GlyphTextInstance): GlyphNode | GlyphTextInstance {
    return instance;
  },

  prepareForCommit(_containerInfo: GlyphContainer): null {
    return null;
  },

  resetAfterCommit(containerInfo: GlyphContainer): void {
    containerInfo.onCommit();
  },

  preparePortalMount(): void {},

  // Mutation methods
  appendChild(
    parentInstance: GlyphNode,
    child: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text") {
      glyphAppendTextChild(parentInstance, child as GlyphTextInstance);
    } else {
      glyphAppendChild(parentInstance, child as GlyphNode);
    }
  },

  appendChildToContainer(
    container: GlyphContainer,
    child: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text") return;
    const node = child as GlyphNode;
    node.parent = null;
    container.children.push(node);
  },

  insertBefore(
    parentInstance: GlyphNode,
    child: GlyphNode | GlyphTextInstance,
    beforeChild: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text") {
      glyphInsertTextBefore(parentInstance, child as GlyphTextInstance, beforeChild as GlyphChild);
    } else if (beforeChild.type === "raw-text") {
      // Insert node before a text child - need to handle allChildren ordering
      const node = child as GlyphNode;
      node.parent = parentInstance;
      parentInstance.children.push(node);
      const allIdx = parentInstance.allChildren.indexOf(beforeChild as GlyphChild);
      if (allIdx !== -1) {
        parentInstance.allChildren.splice(allIdx, 0, node);
      } else {
        parentInstance.allChildren.push(node);
      }
    } else {
      glyphInsertBefore(parentInstance, child as GlyphNode, beforeChild as GlyphNode);
    }
  },

  insertInContainerBefore(
    container: GlyphContainer,
    child: GlyphNode | GlyphTextInstance,
    beforeChild: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text" || beforeChild.type === "raw-text") return;
    const node = child as GlyphNode;
    const before = beforeChild as GlyphNode;
    const idx = container.children.indexOf(before);
    if (idx !== -1) {
      container.children.splice(idx, 0, node);
    } else {
      container.children.push(node);
    }
  },

  removeChild(
    parentInstance: GlyphNode,
    child: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text") {
      glyphRemoveTextChild(parentInstance, child as GlyphTextInstance);
    } else {
      glyphRemoveChild(parentInstance, child as GlyphNode);
    }
  },

  removeChildFromContainer(
    container: GlyphContainer,
    child: GlyphNode | GlyphTextInstance,
  ): void {
    if (child.type === "raw-text") return;
    const node = child as GlyphNode;
    const idx = container.children.indexOf(node);
    if (idx !== -1) {
      container.children.splice(idx, 1);
    }
  },

  commitTextUpdate(
    textInstance: GlyphTextInstance,
    _oldText: string,
    newText: string,
  ): void {
    textInstance.text = newText;
    if (textInstance.parent) {
      // Rebuild parent text from tracked raw text children
      textInstance.parent.text = textInstance.parent.rawTextChildren
        .map((t) => t.text)
        .join("");
    }
  },

  // v0.31 signature: (instance, type, oldProps, newProps, internalHandle)
  // updatePayload was removed in this version
  commitUpdate(
    instance: GlyphNode,
    _type: string,
    _oldProps: Props,
    newProps: Props,
    _internalHandle: any,
  ): void {
    instance.props = newProps;
    instance.style = (newProps.style as Style) ?? {};
    if (newProps.focusable && !instance.focusId) {
      instance.focusId = `focus-${Math.random().toString(36).slice(2, 9)}`;
    }
  },

  hideInstance(instance: GlyphNode): void {
    instance.hidden = true;
  },

  hideTextInstance(textInstance: GlyphTextInstance): void {
    textInstance.text = "";
  },

  unhideInstance(instance: GlyphNode, _props: Props): void {
    instance.hidden = false;
  },

  unhideTextInstance(textInstance: GlyphTextInstance, text: string): void {
    textInstance.text = text;
  },

  clearContainer(container: GlyphContainer): void {
    container.children.length = 0;
  },

  resetTextContent(instance: GlyphNode): void {
    instance.text = null;
  },
};

