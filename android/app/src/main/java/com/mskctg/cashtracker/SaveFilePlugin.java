package com.mskctg.cashtracker;

import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Saves a file that the web app produced (PDF, CSV or JSON backup) into the
 * device's Downloads folder.
 *
 * The web app calls it as:  AndroidBridge.saveFile(name, mime, base64)
 */
@CapacitorPlugin(name = "AndroidBridge")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = call.getString("name");
        String mime = call.getString("mime");
        String base64 = call.getString("base64");

        if (name == null || name.isEmpty()) {
            call.reject("Missing file name");
            return;
        }
        if (base64 == null || base64.isEmpty()) {
            call.reject("Missing file content");
            return;
        }
        if (mime == null || mime.isEmpty()) mime = "application/octet-stream";

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            String location = writeToDownloads(name, mime, bytes);

            JSObject ret = new JSObject();
            ret.put("path", location);
            ret.put("name", name);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not save the file: " + e.getMessage(), e);
        }
    }

    private String writeToDownloads(String name, String mime, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, name);
            values.put(MediaStore.Downloads.MIME_TYPE, mime);
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            android.net.Uri uri = getContext().getContentResolver()
                    .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("MediaStore insert failed");

            java.io.OutputStream out = getContext().getContentResolver().openOutputStream(uri);
            if (out != null) {
                out.write(bytes);
                out.close();
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            getContext().getContentResolver().update(uri, values, null, null);
            return uri.toString();
        }

        // Android 9 and older
        @SuppressWarnings("deprecation")
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Cannot create Downloads folder");
        File file = new File(dir, name);
        FileOutputStream fos = new FileOutputStream(file);
        fos.write(bytes);
        fos.close();
        return file.getAbsolutePath();
    }
}
