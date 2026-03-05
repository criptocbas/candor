import React, { Component, ErrorInfo } from "react";
import { View, Text, Pressable } from "react-native";
import { colors } from "../theme/colors";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
            gap: 16,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontFamily: "SpaceGrotesk_700Bold",
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: colors.textTertiary,
              fontSize: 14,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            The app ran into an unexpected error. Your data is safe — try restarting.
          </Text>
          {__DEV__ && this.state.error && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                width: "100%",
                marginTop: 8,
              }}
            >
              <Text
                style={{
                  color: colors.error,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
                numberOfLines={6}
              >
                {this.state.error.message}
              </Text>
            </View>
          )}
          <Pressable
            onPress={this.handleReset}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 24,
              paddingHorizontal: 32,
              paddingVertical: 14,
              marginTop: 8,
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontSize: 15,
                fontFamily: "SpaceGrotesk_600SemiBold",
                fontWeight: "600",
              }}
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
