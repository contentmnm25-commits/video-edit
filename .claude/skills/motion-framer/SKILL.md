---
name: motion-framer
description: Animation library for React (Motion, formerly Framer Motion). Create smooth, production-ready animations with motion components, variants, gestures (hover/tap/drag), layout animations, AnimatePresence exit animations, spring physics, and scroll-based effects. Use when building interactive UI components, micro-interactions, page transitions, or complex animation sequences.
---

# Motion (formerly Framer Motion)

## Overview

Motion is a production-ready animation library for React and vanilla JavaScript. It provides `motion` components that wrap HTML/SVG elements with declarative animation props, gesture recognition (hover, tap, drag, focus), layout animations, exit animations, and spring physics.

**When to use this skill:**
- Interactive UI components (buttons, cards, menus)
- Micro-interactions and hover effects
- Page transitions and route animations
- Scroll-linked and scroll-triggered animations
- Animating layout changes (resizing, reordering, shared element transitions)
- Drag-and-drop interfaces (e.g. timeline clips, sliders)
- Complex sequences and state-based animations

**Package and imports:**
- Current package: `motion` — install with `npm install motion`
- React import: `import { motion, AnimatePresence } from "motion/react"`
- Vanilla JS import: `import { animate, scroll, inView } from "motion"`
- Legacy package: `framer-motion` (same React API, import from `"framer-motion"`). If a project already depends on `framer-motion`, match its imports instead of mixing packages.
- React 18+; TypeScript types included; works with Next.js, Vite, Remix.
- Next.js App Router: components using `motion.*` must be client components (`"use client"`), or import from `"motion/react-client"`.

All examples below use `"motion/react"`.

## Core Concepts

### 1. Motion Components

Prefix any HTML/SVG element with `motion.`:

```jsx
import { motion } from "motion/react"

<motion.div />
<motion.button />
<motion.svg />
<motion.path />
```

Every motion component accepts animation props (`animate`, `initial`, `exit`, `transition`) and gesture props (`whileHover`, `whileTap`, `whileDrag`, `whileFocus`, `whileInView`).

### 2. Animate Prop

`animate` defines the target state. When its values change, Motion animates to them:

```jsx
<motion.div animate={{ x: 100 }} />

<motion.div animate={{ x: 100, opacity: 1, scale: 1.2 }} />

const [isOpen, setIsOpen] = useState(false)
<motion.div animate={{ width: isOpen ? 300 : 100 }} />
```

### 3. Initial State

```jsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
/>
```

`initial={false}` skips the mount animation and starts at the `animate` values.

### 4. Transitions

```jsx
// Duration-based
<motion.div
  animate={{ x: 100 }}
  transition={{ duration: 0.5, ease: "easeInOut" }}
/>

// Spring physics
<motion.div
  animate={{ scale: 1.2 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
/>

// Per-property transitions
<motion.div
  animate={{ x: 100, opacity: 1 }}
  transition={{
    x: { type: "spring", stiffness: 300 },
    opacity: { duration: 0.2 }
  }}
/>
```

**Transition types:**
- `"tween"` — duration + easing
- `"spring"` — physics-based
- `"inertia"` — decelerating (used by drag momentum)

**Defaults:** physical values (`x`, `y`, `scale`, `rotate`) default to a spring; visual values (`opacity`, colors) default to a tween. Set `type` explicitly if you need predictable timing.

### 5. Variants

Named animation states, which also propagate to children:

```jsx
const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.9 }
}

<motion.div
  variants={variants}
  initial="hidden"
  animate="visible"
  exit="exit"
/>
```

**Propagation and stagger:** children with `variants` inherit the parent's active variant label — do not set `initial`/`animate` on the children.

```jsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: { x: 0, opacity: 1 }
}

<motion.ul variants={containerVariants} initial="hidden" animate="visible">
  <motion.li variants={itemVariants} />
  <motion.li variants={itemVariants} />
  <motion.li variants={itemVariants} />
</motion.ul>
```

## Common Patterns

### 1. Hover

```jsx
<motion.button whileHover={{ scale: 1.1 }}>
  Hover me
</motion.button>

<motion.div
  whileHover={{
    scale: 1.05,
    backgroundColor: "#f0f0f0",
    boxShadow: "0px 10px 30px rgba(0, 0, 0, 0.2)"
  }}
/>

// Different timing for hover-in vs hover-out
<motion.button
  whileHover={{
    scale: 1.2,
    transition: { duration: 0.1 }  // used when hover starts
  }}
  transition={{ duration: 0.5 }}   // used when hover ends (and for hover start if the line above is omitted)
/>
```

Hover only fires for real pointer devices — it is not emulated by touch.

**Propagating hover to nested elements:**

```jsx
<motion.div initial="rest" whileHover="hover">
  <motion.h3 variants={titleVariants}>Title</motion.h3>
  <motion.img variants={imageVariants} />
</motion.div>
```

### 2. Tap / Press

```jsx
<motion.button whileTap={{ scale: 0.9 }}>Click me</motion.button>

<motion.button
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.95, rotate: 3 }}
/>

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.1 },
  pressed: { scale: 0.95 }
}

<motion.button
  variants={buttonVariants}
  initial="rest"
  whileHover="hover"
  whileTap="pressed"
/>
```

`whileTap` elements are keyboard-accessible: Enter triggers tap start/end.

### 3. Drag

```jsx
<motion.div drag />
<motion.div drag="x" />
<motion.div drag="y" />

// Pixel constraints
<motion.div
  drag
  dragConstraints={{ left: -100, right: 100, top: -100, bottom: 100 }}
/>

// Constrain to a parent element via ref
const constraintsRef = useRef(null)
<motion.div ref={constraintsRef}>
  <motion.div drag dragConstraints={constraintsRef} />
</motion.div>

// Feedback while dragging
<motion.div
  drag
  whileDrag={{ scale: 1.1, boxShadow: "0px 10px 20px rgba(0,0,0,0.2)" }}
  dragElastic={0.1}        // 0 = hard stop at constraints, 1 = fully elastic
  dragMomentum={false}     // disable inertia after release (useful for snapping editors)
  dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
/>
```

**Drag events:**

```jsx
<motion.div
  drag
  onDragStart={(event, info) => console.log(info.point)}
  onDrag={(event, info) => console.log(info.offset)}
  onDragEnd={(event, info) => console.log(info.velocity)}
/>
```

For list reordering, use `Reorder.Group` / `Reorder.Item` from `"motion/react"` instead of hand-rolling drag logic.

### 4. Exit Animations (AnimatePresence)

```jsx
import { AnimatePresence, motion } from "motion/react"

<AnimatePresence>
  {isVisible && (
    <motion.div
      key="modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

**Requirements:**
- The conditionally rendered element must be a direct child of `<AnimatePresence>` (or a component whose root is a motion component with `exit`).
- Each child needs a stable, unique `key`. Changing the key of a single child triggers exit + enter — the standard way to crossfade content (e.g. slideshows).
- `mode="wait"` waits for the exiting child to finish before mounting the new one; `mode="popLayout"` pairs well with `layout` on siblings.

**List items:**

```jsx
<AnimatePresence>
  {items.map(item => (
    <motion.li
      key={item.id}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      layout
    >
      {item.name}
    </motion.li>
  ))}
</AnimatePresence>
```

**Staggered exit:**

```jsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { when: "beforeChildren", staggerChildren: 0.1 }
  },
  exit: {
    opacity: 0,
    transition: {
      when: "afterChildren",
      staggerChildren: 0.05,
      staggerDirection: -1
    }
  }
}

<AnimatePresence>
  {show && (
    <motion.div key="list" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
      <motion.div variants={itemVariants} />
      <motion.div variants={itemVariants} />
      <motion.div variants={itemVariants} />
    </motion.div>
  )}
</AnimatePresence>
```

### 5. Layout Animations

```jsx
<motion.div layout />            // position and size
<motion.div layout="position" /> // position only
<motion.div layout="size" />     // size only
```

Layout animations use transforms, so a size change can distort children (text, border-radius). Fix by giving affected children `layout` too, or set `borderRadius`/`boxShadow` via `style` so Motion corrects them.

**Grid:**

```jsx
{items.map(item => (
  <motion.div
    key={item.id}
    layout
    transition={{ layout: { duration: 0.3, ease: "easeInOut" } }}
  />
))}
```

**Shared layout (`layoutId`):**

```jsx
// Tab indicator — button needs position: relative
<nav>
  {tabs.map(tab => (
    <button key={tab.id} onClick={() => setActive(tab.id)} style={{ position: "relative" }}>
      {tab.label}
      {activeTab === tab.id && (
        <motion.div
          layoutId="underline"
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2 }}
        />
      )}
    </button>
  ))}
</nav>

// Thumbnail → expanded view
<motion.img src={thumbnail} layoutId="product-image" onClick={() => setExpanded(true)} />

<AnimatePresence>
  {expanded && (
    <motion.div layoutId="product-image">
      <img src={fullsize} />
    </motion.div>
  )}
</AnimatePresence>
```

If the same `layoutId` is reused in independent component instances, wrap each instance in `<LayoutGroup id="...">` to namespace them.

### 6. Scroll

**Scroll-triggered** (animate when entering viewport):

```jsx
<motion.div
  initial={{ opacity: 0, y: 50 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.8 }}
  transition={{ duration: 0.5 }}
/>
```

Viewport options:
- `once: true` — trigger once
- `amount` — `"some"` | `"all"` | number 0–1
- `margin` — e.g. `"-100px"`, shrinks/grows the detection area
- `root` — ref to a scrolling ancestor (default: window)

**Scroll-linked** (value tied to scroll position):

```jsx
import { motion, useScroll, useTransform } from "motion/react"

function Progress() {
  const { scrollYProgress } = useScroll()
  return <motion.div style={{ scaleX: scrollYProgress, transformOrigin: "0%" }} />
}

function Parallax() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const y = useTransform(scrollYProgress, [0, 1], [-100, 100])
  return <motion.div ref={ref} style={{ y }} />
}
```

### 7. Springs

```jsx
<motion.div animate={{ scale: 1.2 }} transition={{ type: "spring" }} />

// Physics parameters
<motion.div
  animate={{ x: 100 }}
  transition={{
    type: "spring",
    stiffness: 300,  // higher = snappier (default 100)
    damping: 20,     // higher = less bounce (default 10)
    mass: 1          // higher = more inertia (default 1)
  }}
/>

// Duration-based spring (easier to tune)
<motion.div
  animate={{ rotate: 90 }}
  transition={{ type: "spring", visualDuration: 0.5, bounce: 0.25 }}
/>
```

`visualDuration`/`bounce` and `stiffness`/`damping`/`mass` are alternative configurations — don't mix them in one transition.

**Rough presets:**
- Gentle: `stiffness: 100, damping: 20`
- Wobbly: `stiffness: 200, damping: 10`
- Stiff: `stiffness: 400, damping: 30`
- Slow: `stiffness: 50, damping: 20`

## Gestures

```jsx
<motion.div
  whileHover={{ scale: 1.1 }}
  whileTap={{ scale: 0.9 }}
  whileFocus={{ outline: "2px solid #4f46e5" }}
  whileDrag={{ scale: 1.1 }}
  whileInView={{ opacity: 1 }}
/>
```

```jsx
<motion.div
  onHoverStart={(event, info) => {}}
  onHoverEnd={(event, info) => {}}
  onTap={(event, info) => {}}
  onTapStart={(event, info) => {}}
  onTapCancel={(event, info) => {}}
  onDragStart={(event, info) => {}}
  onDrag={(event, info) => {}}
  onDragEnd={(event, info) => {}}
  onViewportEnter={(entry) => {}}
  onViewportLeave={(entry) => {}}
/>
```

Drag `info` contains `point`, `delta`, `offset`, `velocity` (each `{ x, y }`). Tap/hover `info` contains `point`.

## Hooks

### useAnimate

Imperative animations scoped to a ref:

```jsx
import { useAnimate, stagger } from "motion/react"

function Component() {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    animate([
      [scope.current, { opacity: 1 }],
      ["li", { x: 0, opacity: 1 }, { delay: stagger(0.1) }],
      [".button", { scale: 1.2 }]
    ])
  }, [])

  return (
    <div ref={scope} style={{ opacity: 0 }}>
      <ul>
        <li style={{ opacity: 0, transform: "translateX(-20px)" }}>Item 1</li>
        <li style={{ opacity: 0, transform: "translateX(-20px)" }}>Item 2</li>
      </ul>
      <button className="button">Click</button>
    </div>
  )
}
```

Selectors are scoped to `scope.current`; animations are cleaned up on unmount.

**Playback controls:**

```jsx
const controls = animate(element, { x: 100 })
controls.play()
controls.pause()
controls.stop()
controls.speed = 0.5
controls.time = 0
await controls // resolves when finished
```

### Motion values

```jsx
import { motion, useMotionValue, useTransform, useSpring } from "motion/react"

const x = useMotionValue(0)
const opacity = useTransform(x, [-100, 0, 100], [0, 1, 0])
const smoothX = useSpring(x, { stiffness: 300, damping: 20 })

<motion.div drag="x" style={{ x, opacity }} />
```

Motion values update outside React's render cycle — changing them does not re-render the component. Read with `.get()`, write with `.set()`, subscribe with `useMotionValueEvent(value, "change", cb)`.

### useInView

```jsx
import { useInView } from "motion/react"

function Component() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.5 })
  return <div ref={ref}>{isInView ? "In view" : "Not in view"}</div>
}
```

## Integration Notes

### With GSAP

Avoid having Motion and GSAP animate the **same property on the same element** — they will fight over `transform`. Split responsibilities: e.g. GSAP drives a timeline on an inner element, Motion handles gestures on a wrapper.

```jsx
import { motion } from "motion/react"
import gsap from "gsap"

function Component() {
  const innerRef = useRef(null)

  const handleClick = () => {
    gsap.timeline()
      .to(innerRef.current, { rotation: 360, duration: 1 })
      .to(innerRef.current, { scale: 1.5, duration: 0.5 })
  }

  return (
    <motion.div whileHover={{ scale: 1.1 }} onClick={handleClick}>
      <div ref={innerRef} />
    </motion.div>
  )
}
```

### With React Three Fiber

`framer-motion-3d` is deprecated; don't add it. Drive Three.js objects from motion values by subscribing to changes rather than polling every frame:

```jsx
import { useRef, useEffect } from "react"
import { useMotionValue, animate } from "motion/react"

function Box({ targetX }) {
  const meshRef = useRef(null)
  const x = useMotionValue(0)

  useEffect(() => x.on("change", v => {
    if (meshRef.current) meshRef.current.position.x = v
  }), [x])

  useEffect(() => {
    const controls = animate(x, targetX, { type: "spring" })
    return () => controls.stop()
  }, [targetX])

  return (
    <mesh ref={meshRef}>
      <boxGeometry />
      <meshStandardMaterial />
    </mesh>
  )
}
```

### Form validation feedback

```jsx
import { motion, AnimatePresence } from "motion/react"

function FormField({ error }) {
  return (
    <div>
      <motion.input
        animate={{
          borderColor: error ? "#ff0000" : "#cccccc",
          x: error ? [0, -10, 10, -10, 10, 0] : 0
        }}
        transition={{ duration: 0.4 }}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ color: "#ff0000" }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
```

The shake keyframes replay only when `error` toggles from falsy to truthy; a change from one error string to another won't re-shake. Key the input on a counter if you need that.

## Performance

1. **Prefer transforms and opacity.** `x`, `y`, `scale`, `rotate`, `opacity` (and `filter`, `clipPath`) can be hardware-accelerated. Animating `top`, `left`, `width`, `height` triggers layout every frame — use `layout` animations instead when the size/position must actually change.

   ```jsx
   <motion.div animate={{ x: 100, scale: 1.2 }} />   // good
   <motion.div animate={{ left: 100, width: 200 }} /> // avoid
   ```

2. **Independent transform props** — `style={{ x: 100, rotate: 45, scale: 1.2 }}` composes into one `transform`. Don't mix these with a raw `transform` string on the same element.

3. **Reduced motion** — respect user preferences:

   ```jsx
   import { MotionConfig, useReducedMotion } from "motion/react"

   // App-wide: disables transform/layout animations when the OS setting is on
   <MotionConfig reducedMotion="user">
     <App />
   </MotionConfig>

   // Per-component
   const shouldReduceMotion = useReducedMotion()
   <motion.div animate={{ x: shouldReduceMotion ? 0 : 100, opacity: 1 }} />
   ```

4. **Layout animations are measured, not free.** Every `layout` element is measured on each re-render that affects layout. Use `layout="position"` when size doesn't change, and don't put `layout` on hundreds of items.

5. **Bundle size** — for size-sensitive pages, use `m` + `LazyMotion` with `domAnimation` (or `domMax` for drag/layout) instead of `motion`.

6. **High-frequency values** (scrubbers, playheads, scroll) belong in motion values, not React state, to avoid re-rendering on every frame.

## Common Pitfalls

### 1. Exit animation without AnimatePresence

```jsx
// ❌ exit never runs — element is removed immediately
{show && <motion.div exit={{ opacity: 0 }} />}

// ✅
<AnimatePresence>
  {show && <motion.div key="box" exit={{ opacity: 0 }} />}
</AnimatePresence>
```

### 2. Missing or unstable keys

```jsx
// ❌ no key, or key={index} — AnimatePresence can't tell which item left
<AnimatePresence>
  {items.map((item, i) => <motion.div key={i} exit={{ opacity: 0 }} />)}
</AnimatePresence>

// ✅ stable IDs
<AnimatePresence>
  {items.map(item => <motion.div key={item.id} exit={{ opacity: 0 }} />)}
</AnimatePresence>
```

### 3. AnimatePresence placed inside the conditional

```jsx
// ❌ AnimatePresence unmounts along with its child
{show && (
  <AnimatePresence>
    <motion.div exit={{ opacity: 0 }} />
  </AnimatePresence>
)}
```

AnimatePresence must stay mounted; only its children should be conditional.

### 4. Animating layout-triggering properties

```jsx
// ❌ janky
<motion.div animate={{ top: 100, left: 50, width: 200 }} />

// ✅
<motion.div animate={{ x: 50, y: 100, scaleX: 2 }} />
// or, if the box really must change size, use layout
```

### 5. Overusing layout animations

Put `layout` only on elements that actually move or resize. For simple enter/exit in a long list, opacity/transform animations are cheaper.

### 6. Setting initial/animate on variant children

```jsx
// ❌ breaks propagation and stagger — child ignores parent's state
<motion.ul variants={container} initial="hidden" animate="visible">
  <motion.li variants={item} initial="hidden" animate="visible" />
</motion.ul>

// ✅ child only declares variants
<motion.ul variants={container} initial="hidden" animate="visible">
  <motion.li variants={item} />
</motion.ul>
```

### 7. Gesture transition precedence

A `transition` inside a gesture target (`whileHover={{ scale: 1.2, transition: {...} }}`) overrides the component's `transition` prop when that gesture **starts**. When the gesture **ends**, the element animates back using the component's `transition` prop. Without a gesture-specific transition, the component's `transition` is used in both directions.

## Resources

- [Motion docs](https://motion.dev/docs) — official documentation (React: https://motion.dev/docs/react)
- [Motion GitHub](https://github.com/motiondivision/motion) — source and changelog
- [Upgrade guide](https://motion.dev/docs/react-upgrade-guide) — migrating from `framer-motion`
