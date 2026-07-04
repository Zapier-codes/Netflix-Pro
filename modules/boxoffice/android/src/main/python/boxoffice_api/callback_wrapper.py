"""
Callback wrapper for Chaquopy Android integration.
Bridges Python event callbacks to Kotlin EventCallbackProxy.
"""

class KotlinCallbackWrapper:
    """Holds a reference to the Kotlin proxy object for event forwarding."""
    
    _proxy = None
    
    @classmethod
    def set_proxy(cls, proxy):
        """Set the Kotlin proxy object (called from Kotlin side)."""
        cls._proxy = proxy
    
    @classmethod
    def call(cls, event_type, data):
        """Forward event to Kotlin proxy. Called from Python event emitters."""
        if cls._proxy is not None:
            cls._proxy.onEvent(event_type, data)
    
    @classmethod
    def clear_proxy(cls):
        """Clear the proxy reference."""
        cls._proxy = None


def make_callback():
    """
    Factory function - returns a Python callable for event registration.
    Usage: engine.register_event_callback("onStatusChange", make_callback())
    """
    def _callback(event_type, data):
        KotlinCallbackWrapper.call(event_type, data)
    return _callback