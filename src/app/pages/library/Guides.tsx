import type { Component } from 'solid-js';
import CallKinds from './guides/CallKinds';
import Threading from './guides/Threading';
import Keepalive from './guides/Keepalive';
import SmoothMotion from './guides/SmoothMotion';
import Clicking from './guides/Clicking';
import ChoosingPort from './guides/ChoosingPort';
import Testing from './guides/Testing';
import Tracing from './guides/Tracing';

const Guides: Component = () => {
  return (
    <>
      <CallKinds />
      <Threading />
      <Keepalive />
      <SmoothMotion />
      <Clicking />
      <ChoosingPort />
      <Testing />
      <Tracing />
    </>
  );
};

export default Guides;
