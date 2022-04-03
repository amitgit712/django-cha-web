from django.shortcuts import render


def video(request):
    context = {}
    return render(request, 'index.html', context)