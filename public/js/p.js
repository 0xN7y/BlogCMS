const quill = new Quill('#editor', {

    theme: 'snow',
    modules: {
    toolbar: {
        container: [
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'header': 1 }, { 'header': 2 }],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'script': 'sub' }, { 'script': 'super' }],
                [{ 'indent': '-1' }, { 'indent': '+1' }],
                [{ 'direction': 'rtl' }],
                [{ 'size': ['small', false, 'large', 'huge'] }],
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'font': [] }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['clean']
            ],
            handlers: {
                image: imageHandler 
            }
        }
    }
});

function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.setAttribute('multiple', 'true'); 
    input.click();

    input.onchange = () => {
        const files = Array.from(input.files); 

        files.forEach((file) => {
            if (file) {
                const reader = new FileReader();
                reader.readAsDataURL(file);

                reader.onload = () => {
                    const base64String = reader.result; 

          
                    const range = quill.getSelection();
                    quill.insertEmbed(range ? range.index : quill.getLength(), 'image', base64String);
                };

                reader.onerror = (error) => console.error('Error converting image:', error);
            }
        });
    };
}



const form = document.querySelector('.post-form');
const contentInput = document.getElementById('content');
const tagsDataInput = document.getElementById('tags-data');

form.addEventListener('submit', function () {
    contentInput.value = quill.root.innerHTML;
    tagsDataInput.value = JSON.stringify(tagsList);
});


const tagsInput = document.getElementById('tags-input');
const tagsContainer = document.getElementById('tags');
let tagsList = [];

tagsInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && this.value.trim() !== '') {
        e.preventDefault();
        const tagValue = this.value.trim();

        if (!tagsList.includes(tagValue)) {
            addTag(tagValue);
        }

        this.value = '';
    }
});

function addTag(tagValue) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    
    const tagText = document.createTextNode(tagValue);
    const removeSpan = document.createElement('span');
    
    removeSpan.className = 'remove-tag';
    removeSpan.textContent = '×';

    removeSpan.addEventListener('click', function() {
        removeTag(tagValue);
    });

    tag.appendChild(tagText);
    tag.appendChild(removeSpan);
    tagsContainer.appendChild(tag);
    tagsList.push(tagValue);
}

function removeTag(tag) {
    tagsList = tagsList.filter(t => t !== tag);
    document.querySelectorAll('.tag').forEach(t => {
        if (t.innerText.includes(tag)) t.remove();
    });
}