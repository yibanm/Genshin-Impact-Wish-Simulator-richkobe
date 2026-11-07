package com.richkobe.giws;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 把备份/截图直接写进系统公共 Download 目录（用户 2026-11-05 要求「默认保存在 Download」）。
 *
 * API 29+：MediaStore.Downloads，免任何存储权限；
 * API 24-28：应用专属外部目录 getExternalFilesDir(DIRECTORY_DOWNLOADS) 下的子文件夹，
 * 同样免权限（公共 Download 在旧版需要 WRITE_EXTERNAL_STORAGE，不申请）。
 * 返回 publicDir 标记供前端区分提示文案。
 */
@CapacitorPlugin(name = "MediaSaver")
public class MediaSaverPlugin extends Plugin {

	/**
	 * 系统「保存到此位置」选择器（ACTION_CREATE_DOCUMENT，SAF）。
	 * 用户裁定 2026-11-07：导出必须自己选保存位置，静默存 Download 用户不知道存哪了。
	 * 选完在 onActivityResult 回调里写流；用户取消则 resolve cancelled=true。
	 */
	@PluginMethod()
	public void saveWithPicker(PluginCall call) {
		String name = call.getString("name");
		String mime = call.getString("mime", "application/octet-stream");
		String base64 = call.getString("base64");
		if (name == null || base64 == null) {
			call.reject("name and base64 are required");
			return;
		}
		byte[] bytes;
		try {
			bytes = Base64.decode(base64, Base64.DEFAULT);
		} catch (IllegalArgumentException e) {
			call.reject("invalid base64 payload");
			return;
		}
		Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
		intent.addCategory(Intent.CATEGORY_OPENABLE);
		intent.setType(mime);
		intent.putExtra(Intent.EXTRA_TITLE, name);
		pendingBytes = bytes;
		startActivityForResult(call, intent, "pickerResult");
	}

	private byte[] pendingBytes;

	@ActivityCallback
	private void pickerResult(PluginCall call, ActivityResult result) {
		if (call == null) return;
		Intent data = result == null ? null : result.getData();
		if (result == null || result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
			pendingBytes = null;
			JSObject ret = new JSObject();
			ret.put("cancelled", true);
			call.resolve(ret);
			return;
		}
		Uri uri = data.getData();
		try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
			if (out == null) throw new Exception("openOutputStream returned null");
			out.write(pendingBytes);
			JSObject ret = new JSObject();
			ret.put("cancelled", false);
			ret.put("path", uri.toString());
			call.resolve(ret);
		} catch (Exception e) {
			call.reject(e.getMessage());
		} finally {
			pendingBytes = null;
		}
	}

	@PluginMethod()
	public void saveToDownloads(PluginCall call) {
		String name = call.getString("name");
		String mime = call.getString("mime", "application/octet-stream");
		String base64 = call.getString("base64");
		if (name == null || base64 == null) {
			call.reject("name and base64 are required");
			return;
		}
		byte[] bytes;
		try {
			bytes = Base64.decode(base64, Base64.DEFAULT);
		} catch (IllegalArgumentException e) {
			call.reject("invalid base64 payload");
			return;
		}
		try {
			boolean publicDir = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q;
			String path = publicDir ? writeMediaStore(name, mime, bytes) : writeAppExternal(name, bytes);
			JSObject ret = new JSObject();
			ret.put("publicDir", publicDir);
			ret.put("path", path);
			call.resolve(ret);
		} catch (Exception e) {
			call.reject(e.getMessage());
		}
	}

	private String writeMediaStore(String name, String mime, byte[] bytes) throws Exception {
		ContentValues values = new ContentValues();
		values.put(MediaStore.Downloads.DISPLAY_NAME, name);
		values.put(MediaStore.Downloads.MIME_TYPE, mime);
		values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
		Uri uri = getContext()
				.getContentResolver()
				.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
		if (uri == null) throw new Exception("MediaStore insert returned null");
		try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
			if (out == null) throw new Exception("openOutputStream returned null");
			out.write(bytes);
		}
		return Environment.DIRECTORY_DOWNLOADS + "/" + name;
	}

	private String writeAppExternal(String name, byte[] bytes) throws Exception {
		File base = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
		if (base == null) throw new Exception("external files dir unavailable");
		File dir = new File(base, "GenshinWishRoll");
		if (!dir.exists() && !dir.mkdirs()) throw new Exception("mkdir failed");
		File target = new File(dir, name);
		try (FileOutputStream out = new FileOutputStream(target)) {
			out.write(bytes);
		}
		return target.getAbsolutePath();
	}
}
