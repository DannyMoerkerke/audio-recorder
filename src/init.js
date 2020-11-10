const recorder = document.querySelector('audio-recorder');
const micPermissionDialog = document.querySelector('#mic-permission-dialog');
const closeButton = document.querySelector('#dialog-close');

recorder.addEventListener('notallowed', () => micPermissionDialog.open());
closeButton.addEventListener('click', () => micPermissionDialog.close());
