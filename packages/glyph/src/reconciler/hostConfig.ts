import { Display } from "yoga-layout";
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
  freeYogaNode,
  freeYogaSubtree,
  yogaAppendChild,
  EMPTY_STYLE,
  shallowStyleEqual,
  markLayoutDirty,
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
  detachDeletedInstance(instance: GlyphNode | GlyphTextInstance): void {
    if (instance.type === "raw-text") return;
    freeYogaNode(instance as GlyphNode);
  },

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
    markLayoutDirty();
    // Sync Yoga tree: add to root Yoga node
    if (container.yogaNode && node.yogaNode) {
      const prev = node.yogaNode.getParent();
      if (prev) prev.removeChild(node.yogaNode);
      container.yogaNode.insertChild(node.yogaNode, container.yogaNode.getChildCount());
    }
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
      // Remove from old position if already a child (React reorders)
      const existingIdx = parentInstance.children.indexOf(node);
      if (existingIdx !== -1) parentInstance.children.splice(existingIdx, 1);
      const existingAllIdx = parentInstance.allChildren.indexOf(node);
      if (existingAllIdx !== -1) parentInstance.allChildren.splice(existingAllIdx, 1);

      node.parent = parentInstance;
      parentInstance.children.push(node);
      const allIdx = parentInstance.allChildren.indexOf(beforeChild as GlyphChild);
      if (allIdx !== -1) {
        parentInstance.allChildren.splice(allIdx, 0, node);
      } else {
        parentInstance.allChildren.push(node);
      }
      // Sync Yoga tree (raw-text has no yogaNode, just append)
      yogaAppendChild(parentInstance, node);
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
    // Sync Yoga tree — derive index from container.children order
    // (yoga getChild() returns new wrapper objects, so === comparison fails)
    if (container.yogaNode && node.yogaNode && before.yogaNode) {
      const prev = node.yogaNode.getParent();
      if (prev) prev.removeChild(node.yogaNode);
      let yogaIdx = 0;
      for (const sibling of container.children) {
        if (sibling === node) break;
        if (sibling.yogaNode) yogaIdx++;
      }
      container.yogaNode.insertChild(node.yogaNode, yogaIdx);
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
    // Sync Yoga tree — detach from Yoga parent first
    if (container.yogaNode && node.yogaNode) {
      const parent = node.yogaNode.getParent();
      if (parent) parent.removeChild(node.yogaNode);
    }
    // Free the entire Yoga subtree synchronously (same rationale as removeChild)
    freeYogaSubtree(node);
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
      textInstance.parent._paintDirty = true;
      // Only mark Yoga dirty when text length changes (measurement may differ).
      // Guard: markDirty() requires the Yoga node to be a leaf with a measure
      // function.  Only `text` and `input` GlyphNodes satisfy this — a `box`
      // parent with both raw-text and element children would crash Yoga's
      // assertion ("Only leaf nodes with custom measure functions…").
      if (textInstance.parent.yogaNode &&
          textInstance.parent._hasMeasureFunc &&
          _oldText.length !== newText.length) {
        textInstance.parent.yogaNode.markDirty();
        markLayoutDirty();
      }
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

    // ── Style change detection ──
    // React re-renders create new style objects with identical values.
    // Only update instance.style (and mark dirty) when VALUES differ.
    // Keeping the old reference stable prevents cascading:
    //   resolveNodeStyles skips → syncYogaStyles skips → text cache hits.
    const newStyle = (newProps.style as Style | undefined) ?? EMPTY_STYLE;
    if (newStyle !== instance.style) {
      if (!shallowStyleEqual(instance.style, newStyle)) {
        instance.style = newStyle;
        instance._paintDirty = true;
        markLayoutDirty();
      }
      // else: same values, keep old reference — nothing to do
    }

    // ── Input content changes ──
    if (instance.type === "input") {
      if (_oldProps.value !== newProps.value ||
          _oldProps.placeholder !== newProps.placeholder ||
          _oldProps.cursorPosition !== newProps.cursorPosition) {
        instance._paintDirty = true;
        if (instance.yogaNode &&
            (_oldProps.value !== newProps.value || _oldProps.placeholder !== newProps.placeholder)) {
          instance.yogaNode.markDirty();
          markLayoutDirty();
        }
      }
    }

    if (newProps.focusable && !instance.focusId) {
      instance.focusId = `focus-${Math.random().toString(36).slice(2, 9)}`;
    }
  },

  hideInstance(instance: GlyphNode): void {
    instance.hidden = true;
    if (instance.yogaNode) instance.yogaNode.setDisplay(Display.None);
    markLayoutDirty();
    instance._paintDirty = true;
    if (instance.parent) instance.parent._paintDirty = true;
  },

  hideTextInstance(textInstance: GlyphTextInstance): void {
    textInstance.text = "";
  },

  unhideInstance(instance: GlyphNode, _props: Props): void {
    instance.hidden = false;
    if (instance.yogaNode) instance.yogaNode.setDisplay(Display.Flex);
    markLayoutDirty();
    instance._paintDirty = true;
    if (instance.parent) instance.parent._paintDirty = true;
  },

  unhideTextInstance(textInstance: GlyphTextInstance, text: string): void {
    textInstance.text = text;
  },

  clearContainer(container: GlyphContainer): void {
    // Detach all Yoga children from root
    if (container.yogaNode) {
      while (container.yogaNode.getChildCount() > 0) {
        container.yogaNode.removeChild(container.yogaNode.getChild(0));
      }
    }
    container.children.length = 0;
  },

  resetTextContent(instance: GlyphNode): void {
    instance.text = null;
  },
};

