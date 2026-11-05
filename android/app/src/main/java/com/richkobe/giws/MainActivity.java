package com.richkobe.giws;

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * 安卓移植版主 Activity。
 *
 * 沉浸式 edge-to-edge：内容穿过状态栏（含挖孔/刘海区）、导航栏与手势条，
 * 全屏游戏化呈现（配合 manifest 的 sensorLandscape 与 appCategory=game）。
 * 配合 styles.xml 的 windowLayoutInDisplayCutoutMode=shortEdges，
 * 横屏时内容才允许延伸进挖孔区（默认 default 模式会避开孔位留黑边）。
 */
public class MainActivity extends BridgeActivity {

	@Override
	public void onCreate(Bundle savedInstanceState) {
		// 注册自研 MediaSaver 插件：备份/截图直接写系统公共 Download 目录。
		// Capacitor 8 的注册 API 是 registerPlugin(Class)，须在 super.onCreate 前调用
		registerPlugin(MediaSaverPlugin.class);
		super.onCreate(savedInstanceState);
		applyImmersive();
	}

	@Override
	public void onWindowFocusChanged(boolean hasFocus) {
		super.onWindowFocusChanged(hasFocus);
		// 从通知栏下拉、分屏切换等场景恢复焦点后系统栏会重新出现，这里再藏一次
		if (hasFocus) applyImmersive();
	}

	private void applyImmersive() {
		// 内容延伸到系统栏区域之下（edge-to-edge 的开关）
		WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
		WindowInsetsControllerCompat controller =
				WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
		controller.hide(WindowInsetsCompat.Type.systemBars());
		// 边缘内滑时系统栏只短暂浮现后自动收回，不打断游戏画面
		controller.setSystemBarsBehavior(
				WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
	}
}
